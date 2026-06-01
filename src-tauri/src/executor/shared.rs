//! executor/shared.rs
//!
//! `run_graph_with_patch` 与 `run_subgraph_inner` 的共享执行循环。
//! 两者节点类型 match 分支完全相同，抽取至此文件避免分化。
//!
//! 差异点：
//! - run_graph_with_patch：全图执行，无增量跳过
//! - run_subgraph_inner：子图执行，有 succeeded_before 跳过逻辑和 include_set 过滤

use crate::db;
use crate::graph::{downstream_descendants, CanvasGraph, FlowNode};
use crate::settings::AppSettings;
use rusqlite::Connection;
use serde_json::json;
use std::collections::{HashMap, HashSet};
use std::path::Path;

use super::ffmpeg::run_ffmpeg_concat;
use super::graph_flow::script_beat_params_patch_if_changed;
use super::llm::run_llm_node;
use super::asset_resolve::{resolve_node_media_asset_id, resolve_node_media_rel_path};
use super::node_output::{encode_media_output_value, output_value_from_run_event_payload};
use super::script_node::run_script_node;

/// 从上一次运行恢复已成功的节点 output
pub(crate) fn recover_run_outputs(conn: &Connection, previous_run_id: &str) -> Result<HashMap<String, String>, String> {
    let events = db::list_run_events(conn, previous_run_id)?;
    let mut out = HashMap::new();
    for ev in events {
        if ev.kind != "node_output" {
            continue;
        }
        let Some(node_id) = ev.node_id else {
            continue;
        };
        let payload: serde_json::Value =
            serde_json::from_str(&ev.payload_json).unwrap_or_else(|_| json!({}));
        if let Some(stored) = output_value_from_run_event_payload(&payload) {
            out.insert(node_id, stored);
        } else if let Some(v) = payload.get("output").and_then(|v| v.as_str()) {
            out.insert(node_id, v.to_string());
        }
    }
    Ok(out)
}

/// 从上一次运行恢复已成功的节点集合
pub(crate) fn recover_run_succeeded(conn: &Connection, previous_run_id: &str) -> Result<HashSet<String>, String> {
    let events = db::list_run_events(conn, previous_run_id)?;
    let mut out = HashSet::new();
    for ev in events {
        if ev.kind != "node_state" {
            continue;
        }
        let Some(node_id) = ev.node_id else {
            continue;
        };
        let payload: serde_json::Value =
            serde_json::from_str(&ev.payload_json).unwrap_or_else(|_| json!({}));
        let state = payload.get("state").and_then(|v| v.as_str()).unwrap_or("");
        if state == "succeeded" {
            out.insert(node_id);
        }
    }
    Ok(out)
}

/// 节点执行结果：`(output, data_patch)`；跳过则两者均为 `None`
type NodeStepResult = Result<(Option<String>, Option<serde_json::Value>), String>;

/// 执行单个节点的类型匹配分支（async）。
/// caller 负责在调用前后记录 "running" / "succeeded" / "failed" 日志。
async fn exec_node(
    http: &reqwest::Client,
    project_root: &Path,
    graph: &CanvasGraph,
    node: &FlowNode,
    settings: &AppSettings,
    outputs: &HashMap<String, String>,
    conn: &mut Connection,
    run_id: &str,
) -> NodeStepResult {
    let kind = node.node_type.as_str();

    match kind {
        "scriptNode" => {
            let (res, patch) =
                run_script_node(http, project_root, graph, node, settings, outputs, conn, run_id).await?;
            let _ = db::log_event(conn, run_id, Some(&node.id), "node_output", &json!({ "output": res }));
            let _ = db::log_event(conn, run_id, Some(&node.id), "node_patch", &patch);
            Ok((Some(res), Some(patch)))
        }

        "llm" | "textNode" => {
            let res = run_llm_node(http, graph, node, settings, outputs, conn, run_id).await?;
            let _ = db::log_event(conn, run_id, Some(&node.id), "node_output", &json!({ "output": res }));
            Ok((Some(res), None))
        }

        "imageNode" | "audioNode" | "videoNode" | "mediaImport" | "imageAsset" => {
            let path = resolve_node_media_rel_path(project_root, &node.data).unwrap_or_default();
            let asset_id = resolve_node_media_asset_id(project_root, &node.data);
            let output_value = encode_media_output_value(&path, asset_id.as_deref());
            let _ = db::log_event(
                conn,
                run_id,
                Some(&node.id),
                "asset",
                &json!({ "path": path, "assetId": asset_id, "kind": kind }),
            );
            let _ = db::log_event(
                conn,
                run_id,
                Some(&node.id),
                "node_output",
                &json!({ "output": path, "assetId": asset_id }),
            );
            let data_patch = script_beat_params_patch_if_changed(graph, node);
            Ok((Some(output_value), data_patch))
        }

        "ffmpegConcat" => {
            let out = run_ffmpeg_concat(project_root, node, settings, conn, run_id)?;
            let _ = db::log_event(conn, run_id, Some(&node.id), "node_output", &json!({ "output": out }));
            Ok((Some(out), None))
        }

        _ => {
            let _ = db::log_event(conn, run_id, Some(&node.id), "skip", &json!({ "type": kind }));
            let _ = db::log_event(
                conn, run_id, Some(&node.id), "node_state",
                &json!({ "state": "skipped", "reason": "unsupported_type", "nodeType": kind }),
            );
            Ok((None, None))
        }
    }
}

/// 共享节点执行循环。
///
/// Params:
/// - `http`, `project_root`, `graph`, `settings` — 执行上下文
/// - `node_ids` — 按拓扑序排列的节点 ID 列表（已由 caller 过滤）
/// - `succeeded_set` — 已成功的节点集合（增量跳过），传入 None 则不跳过任何节点（全图执行）
/// - `include_set` — 在此范围内的节点才受下游失败影响（子图执行传 subtree，全图传所有节点）
/// - `run_id`, `collect_patches` — 运行追踪
/// - `extra_start_metadata` — run_start 日志中的额外字段
/// - `script_patches` — 输出参数：scriptNode 的 (node_id, data_patch) 列表
pub(crate) async fn exec_node_loop(
    http: &reqwest::Client,
    project_root: &Path,
    graph: &CanvasGraph,
    settings: &AppSettings,
    node_ids: &[String],
    succeeded_set: Option<&HashSet<String>>,
    include_set: &HashSet<String>,
    run_id: &str,
    _collect_patches: bool,
    extra_start_metadata: serde_json::Value,
    script_patches: &mut Vec<(String, serde_json::Value)>,
) -> Result<(HashMap<String, String>, bool), String> {
    let mut outputs: HashMap<String, String> = HashMap::new();
    let mut skip: HashSet<String> = HashSet::new();
    let mut any_node_failed = false;

    let mut conn = db::open_run_db(project_root)?;
    db::log_event(&conn, run_id, None, "run_start", &extra_start_metadata)?;

    for node_id in node_ids {
        // 上游失败导致跳过
        if skip.contains(node_id) {
            let _ = db::log_event(
                &conn, run_id, Some(node_id), "node_state",
                &json!({ "state": "skipped", "reason": "upstream_failed" }),
            );
            continue;
        }

        // 增量运行：已在 succeeded_set 中则复用 output 并跳过
        if let Some(set) = succeeded_set {
            if set.contains(node_id) {
                if let Some(prev) = outputs.get(node_id).cloned()
                    .or_else(|| recover_run_outputs(&conn, run_id).ok()?.get(node_id).cloned())
                {
                    outputs.insert(node_id.clone(), prev);
                }
                let _ = db::log_event(
                    &conn, run_id, Some(node_id), "node_state",
                    &json!({ "state": "skipped", "reason": "already_succeeded" }),
                );
                continue;
            }
        }

        let node = graph.nodes.iter().find(|n| n.id == *node_id)
            .ok_or_else(|| format!("找不到节点 {}", node_id))?;

        let _ = db::log_event(&conn, run_id, Some(node_id), "node_state", &json!({ "state": "running" }));

        let step = exec_node(http, project_root, graph, node, settings, &outputs, &mut conn, run_id).await;

        match step {
            Ok((Some(output), data_patch)) => {
                outputs.insert(node_id.clone(), output);
                if let Some(patch) = data_patch {
                    script_patches.push((node_id.clone(), patch));
                }
                let _ = db::log_event(&conn, run_id, Some(node_id), "node_state", &json!({ "state": "succeeded" }));
            }
            Ok((None, _)) => {
                // skipped — 已在 exec_node 中记录
            }
            Err(e) => {
                any_node_failed = true;
                let _ = db::log_event(&conn, run_id, Some(node_id), "node_state", &json!({ "state": "failed", "error": e }));
                if settings.abort_workflow_on_failure {
                    let _ = db::finish_run(&conn, run_id, false, Some(&e));
                    return Err(e);
                }
                for d in downstream_descendants(graph, node_id) {
                    if include_set.contains(&d) {
                        skip.insert(d);
                    }
                }
            }
        }
    }

    Ok((outputs, any_node_failed))
}