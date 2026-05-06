use crate::db;
use crate::graph::{downstream_descendants, CanvasGraph};
use crate::settings::AppSettings;
use rusqlite::Connection;
use serde_json::json;
use std::collections::{HashMap, HashSet};
use std::path::Path;

use super::ffmpeg::run_ffmpeg_concat;
use super::graph_flow::{node_by_id, script_beat_params_patch_if_changed};
use super::llm::run_llm_node;
use super::script_node::run_script_node;
use super::types::{GraphRunResult, NodeDataPatch};

/// 与 `run_graph_with_patch` 行为一致（含脚本专算子），仅返回 `run_id`（丢弃节点 patch）。
pub async fn run_graph(
    http: &reqwest::Client,
    project_root: &Path,
    graph: &CanvasGraph,
    settings: &AppSettings,
) -> Result<String, String> {
    run_graph_with_patch(http, project_root, graph, settings)
        .await
        .map(|r| r.run_id)
}

pub async fn run_graph_with_patch(
    http: &reqwest::Client,
    project_root: &Path,
    graph: &CanvasGraph,
    settings: &AppSettings,
) -> Result<GraphRunResult, String> {
    let order = crate::graph::topological_order(graph)?;
    let run_id = uuid::Uuid::new_v4().to_string();
    let mut conn = db::open_run_db(project_root)?;
    db::insert_run(&conn, &run_id)?;
    db::mark_run_running(&conn, &run_id)?;
    db::log_event(
        &conn,
        &run_id,
        None,
        "run_start",
        &json!({ "nodeCount": graph.nodes.len() }),
    )?;

    let mut outputs: HashMap<String, String> = HashMap::new();
    let mut skip: HashSet<String> = HashSet::new();
    let mut any_node_failed = false;
    let mut node_patches: Vec<NodeDataPatch> = Vec::new();

    let exec = async {
        for node_id in order {
            if skip.contains(&node_id) {
                db::log_event(
                    &conn,
                    &run_id,
                    Some(&node_id),
                    "node_state",
                    &json!({ "state": "skipped", "reason": "upstream_failed" }),
                )?;
                continue;
            }
            let node = node_by_id(graph, &node_id).ok_or_else(|| format!("找不到节点 {}", node_id))?;
            let kind = node.node_type.as_str();
            db::log_event(
                &conn,
                &run_id,
                Some(&node_id),
                "node_state",
                &json!({ "state": "running" }),
            )?;

            let step_result: Result<bool, String> = match kind {
                "scriptNode" => match run_script_node(http, graph, node, settings, &outputs, &mut conn, &run_id).await
                {
                    Ok((res, patch)) => {
                        db::log_event(
                            &conn,
                            &run_id,
                            Some(&node_id),
                            "node_output",
                            &json!({ "output": res }),
                        )?;
                        outputs.insert(node_id.clone(), res);
                        node_patches.push(NodeDataPatch {
                            node_id: node_id.clone(),
                            data_patch: patch,
                        });
                        Ok(true)
                    }
                    Err(e) => Err(e),
                },
                "llm" | "textNode" => {
                    match run_llm_node(http, graph, node, settings, &outputs, &mut conn, &run_id).await {
                        Ok(res) => {
                            db::log_event(
                                &conn,
                                &run_id,
                                Some(&node_id),
                                "node_output",
                                &json!({ "output": res }),
                            )?;
                            outputs.insert(node_id.clone(), res);
                            Ok(true)
                        }
                        Err(e) => Err(e),
                    }
                }
                "imageNode" | "audioNode" => {
                    let path = node
                        .data
                        .get("path")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    db::log_event(
                        &conn,
                        &run_id,
                        Some(&node_id),
                        "asset",
                        &json!({ "path": path, "kind": kind }),
                    )?;
                    db::log_event(
                        &conn,
                        &run_id,
                        Some(&node_id),
                        "node_output",
                        &json!({ "output": path }),
                    )?;
                    outputs.insert(node_id.clone(), path);
                    if let Some(patch) = script_beat_params_patch_if_changed(graph, node) {
                        node_patches.push(NodeDataPatch {
                            node_id: node_id.clone(),
                            data_patch: patch,
                        });
                    }
                    Ok(true)
                }
                "videoNode" => {
                    let path = node
                        .data
                        .get("path")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    db::log_event(
                        &conn,
                        &run_id,
                        Some(&node_id),
                        "asset",
                        &json!({ "path": path, "kind": kind }),
                    )?;
                    db::log_event(
                        &conn,
                        &run_id,
                        Some(&node_id),
                        "node_output",
                        &json!({ "output": path }),
                    )?;
                    outputs.insert(node_id.clone(), path);
                    if let Some(patch) = script_beat_params_patch_if_changed(graph, node) {
                        node_patches.push(NodeDataPatch {
                            node_id: node_id.clone(),
                            data_patch: patch,
                        });
                    }
                    Ok(true)
                }
                "mediaImport" | "imageAsset" => {
                    let path = node
                        .data
                        .get("path")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    db::log_event(
                        &conn,
                        &run_id,
                        Some(&node_id),
                        "asset",
                        &json!({ "path": path, "kind": kind }),
                    )?;
                    db::log_event(
                        &conn,
                        &run_id,
                        Some(&node_id),
                        "node_output",
                        &json!({ "output": path }),
                    )?;
                    outputs.insert(node_id.clone(), path);
                    Ok(true)
                }
                "ffmpegConcat" => match run_ffmpeg_concat(project_root, node, settings, &mut conn, &run_id) {
                    Ok(out) => {
                        db::log_event(
                            &conn,
                            &run_id,
                            Some(&node_id),
                            "node_output",
                            &json!({ "output": out }),
                        )?;
                        outputs.insert(node_id.clone(), out);
                        Ok(true)
                    }
                    Err(e) => Err(e),
                },
                _ => {
                    db::log_event(
                        &conn,
                        &run_id,
                        Some(&node_id),
                        "skip",
                        &json!({ "type": kind }),
                    )?;
                    db::log_event(
                        &conn,
                        &run_id,
                        Some(&node_id),
                        "node_state",
                        &json!({ "state": "skipped", "reason": "unsupported_type", "nodeType": kind }),
                    )?;
                    Ok(false)
                }
            };

            match step_result {
                Ok(true) => {
                    db::log_event(
                        &conn,
                        &run_id,
                        Some(&node_id),
                        "node_state",
                        &json!({ "state": "succeeded" }),
                    )?;
                }
                Ok(false) => {}
                Err(e) => {
                    any_node_failed = true;
                    db::log_event(
                        &conn,
                        &run_id,
                        Some(&node_id),
                        "node_state",
                        &json!({ "state": "failed", "error": e }),
                    )?;
                    if settings.abort_workflow_on_failure {
                        return Err(e);
                    }
                    for d in downstream_descendants(graph, &node_id) {
                        skip.insert(d);
                    }
                }
            }
        }
        Ok::<(), String>(())
    };

    match exec.await {
        Ok(()) => {
            db::log_event(
                &conn,
                &run_id,
                None,
                "run_summary",
                &json!({ "anyNodeFailed": any_node_failed, "abortWorkflowOnFailure": settings.abort_workflow_on_failure }),
            )?;
            db::finish_run(&conn, &run_id, true, None)?;
            Ok(GraphRunResult { run_id, node_patches })
        }
        Err(e) => {
            let _ = db::finish_run(&conn, &run_id, false, Some(&e));
            Err(e)
        }
    }
}

fn succeeded_nodes_from_run(
    conn: &Connection,
    previous_run_id: &str,
) -> Result<HashSet<String>, String> {
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

fn outputs_from_run(
    conn: &Connection,
    previous_run_id: &str,
) -> Result<HashMap<String, String>, String> {
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
        if let Some(v) = payload.get("output").and_then(|v| v.as_str()) {
            out.insert(node_id, v.to_string());
        }
    }
    Ok(out)
}

async fn run_subgraph_inner(
    http: &reqwest::Client,
    project_root: &Path,
    graph: &CanvasGraph,
    settings: &AppSettings,
    from_node_id: &str,
    previous_run_id: Option<&str>,
    force: bool,
    collect_patches: bool,
) -> Result<(String, Vec<NodeDataPatch>), String> {
    let order = crate::graph::topological_order(graph)?;
    if node_by_id(graph, from_node_id).is_none() {
        return Err(format!("找不到节点 {}", from_node_id));
    }
    let mut include = downstream_descendants(graph, from_node_id);
    include.insert(from_node_id.to_string());
    let order: Vec<String> = order.into_iter().filter(|id| include.contains(id)).collect();

    let run_id = uuid::Uuid::new_v4().to_string();
    let mut conn = db::open_run_db(project_root)?;
    let succeeded_before = if force {
        HashSet::new()
    } else if let Some(prev) = previous_run_id {
        succeeded_nodes_from_run(&conn, prev)?
    } else {
        HashSet::new()
    };
    let output_before = if force {
        HashMap::new()
    } else if let Some(prev) = previous_run_id {
        outputs_from_run(&conn, prev)?
    } else {
        HashMap::new()
    };

    db::insert_run(&conn, &run_id)?;
    db::mark_run_running(&conn, &run_id)?;
    db::log_event(
        &conn,
        &run_id,
        None,
        "run_start",
        &json!({
            "nodeCount": order.len(),
            "subgraphFromNodeId": from_node_id,
            "previousRunId": previous_run_id,
            "force": force,
        }),
    )?;

    let mut outputs: HashMap<String, String> = HashMap::new();
    let mut skip: HashSet<String> = HashSet::new();
    let mut any_node_failed = false;
    let mut node_patches: Vec<NodeDataPatch> = Vec::new();

    let exec = async {
        for node_id in order {
            if skip.contains(&node_id) {
                db::log_event(
                    &conn,
                    &run_id,
                    Some(&node_id),
                    "node_state",
                    &json!({ "state": "skipped", "reason": "upstream_failed" }),
                )?;
                continue;
            }
            if !force && succeeded_before.contains(&node_id) {
                if let Some(prev_out) = output_before.get(&node_id) {
                    outputs.insert(node_id.clone(), prev_out.clone());
                }
                db::log_event(
                    &conn,
                    &run_id,
                    Some(&node_id),
                    "node_state",
                    &json!({ "state": "skipped", "reason": "already_succeeded" }),
                )?;
                continue;
            }

            let node =
                node_by_id(graph, &node_id).ok_or_else(|| format!("找不到节点 {}", node_id))?;
            let kind = node.node_type.as_str();
            db::log_event(
                &conn,
                &run_id,
                Some(&node_id),
                "node_state",
                &json!({ "state": "running" }),
            )?;

            let step_result: Result<bool, String> = match kind {
                "scriptNode" => match run_script_node(http, graph, node, settings, &outputs, &mut conn, &run_id).await {
                    Ok((res, patch)) => {
                        db::log_event(
                            &conn,
                            &run_id,
                            Some(&node_id),
                            "node_output",
                            &json!({ "output": res }),
                        )?;
                        outputs.insert(node_id.clone(), res);
                        if collect_patches {
                            node_patches.push(NodeDataPatch {
                                node_id: node_id.clone(),
                                data_patch: patch,
                            });
                        }
                        Ok(true)
                    }
                    Err(e) => Err(e),
                },
                "llm" | "textNode" => {
                    match run_llm_node(http, graph, node, settings, &outputs, &mut conn, &run_id).await
                    {
                        Ok(res) => {
                            db::log_event(
                                &conn,
                                &run_id,
                                Some(&node_id),
                                "node_output",
                                &json!({ "output": res }),
                            )?;
                            outputs.insert(node_id.clone(), res);
                            Ok(true)
                        }
                        Err(e) => Err(e),
                    }
                }
                "imageNode" | "audioNode" => {
                    let path = node
                        .data
                        .get("path")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    db::log_event(
                        &conn,
                        &run_id,
                        Some(&node_id),
                        "asset",
                        &json!({ "path": path, "kind": kind }),
                    )?;
                    db::log_event(
                        &conn,
                        &run_id,
                        Some(&node_id),
                        "node_output",
                        &json!({ "output": path }),
                    )?;
                    outputs.insert(node_id.clone(), path);
                    if collect_patches {
                        if let Some(patch) = script_beat_params_patch_if_changed(graph, node) {
                            node_patches.push(NodeDataPatch {
                                node_id: node_id.clone(),
                                data_patch: patch,
                            });
                        }
                    }
                    Ok(true)
                }
                "videoNode" => {
                    let path = node
                        .data
                        .get("path")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    db::log_event(
                        &conn,
                        &run_id,
                        Some(&node_id),
                        "asset",
                        &json!({ "path": path, "kind": kind }),
                    )?;
                    db::log_event(
                        &conn,
                        &run_id,
                        Some(&node_id),
                        "node_output",
                        &json!({ "output": path }),
                    )?;
                    outputs.insert(node_id.clone(), path);
                    if collect_patches {
                        if let Some(patch) = script_beat_params_patch_if_changed(graph, node) {
                            node_patches.push(NodeDataPatch {
                                node_id: node_id.clone(),
                                data_patch: patch,
                            });
                        }
                    }
                    Ok(true)
                }
                "mediaImport" | "imageAsset" => {
                    let path = node
                        .data
                        .get("path")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    db::log_event(
                        &conn,
                        &run_id,
                        Some(&node_id),
                        "asset",
                        &json!({ "path": path, "kind": kind }),
                    )?;
                    db::log_event(
                        &conn,
                        &run_id,
                        Some(&node_id),
                        "node_output",
                        &json!({ "output": path }),
                    )?;
                    outputs.insert(node_id.clone(), path);
                    Ok(true)
                }
                "ffmpegConcat" => match run_ffmpeg_concat(project_root, node, settings, &mut conn, &run_id)
                {
                    Ok(out) => {
                        db::log_event(
                            &conn,
                            &run_id,
                            Some(&node_id),
                            "node_output",
                            &json!({ "output": out }),
                        )?;
                        outputs.insert(node_id.clone(), out);
                        Ok(true)
                    }
                    Err(e) => Err(e),
                },
                _ => {
                    db::log_event(
                        &conn,
                        &run_id,
                        Some(&node_id),
                        "skip",
                        &json!({ "type": kind }),
                    )?;
                    db::log_event(
                        &conn,
                        &run_id,
                        Some(&node_id),
                        "node_state",
                        &json!({ "state": "skipped", "reason": "unsupported_type", "nodeType": kind }),
                    )?;
                    Ok(false)
                }
            };

            match step_result {
                Ok(true) => {
                    db::log_event(
                        &conn,
                        &run_id,
                        Some(&node_id),
                        "node_state",
                        &json!({ "state": "succeeded" }),
                    )?;
                }
                Ok(false) => {}
                Err(e) => {
                    any_node_failed = true;
                    db::log_event(
                        &conn,
                        &run_id,
                        Some(&node_id),
                        "node_state",
                        &json!({ "state": "failed", "error": e }),
                    )?;
                    if settings.abort_workflow_on_failure {
                        return Err(e);
                    }
                    for d in downstream_descendants(graph, &node_id) {
                        if include.contains(&d) {
                            skip.insert(d);
                        }
                    }
                }
            }
        }
        Ok::<(), String>(())
    };

    match exec.await {
        Ok(()) => {
            db::log_event(
                &conn,
                &run_id,
                None,
                "run_summary",
                &json!({
                    "anyNodeFailed": any_node_failed,
                    "abortWorkflowOnFailure": settings.abort_workflow_on_failure,
                    "subgraphFromNodeId": from_node_id,
                    "force": force,
                }),
            )?;
            db::finish_run(&conn, &run_id, true, None)?;
            Ok((run_id, node_patches))
        }
        Err(e) => {
            let _ = db::finish_run(&conn, &run_id, false, Some(&e));
            Err(e)
        }
    }
}

pub async fn run_subgraph(
    http: &reqwest::Client,
    project_root: &Path,
    graph: &CanvasGraph,
    settings: &AppSettings,
    from_node_id: &str,
    previous_run_id: Option<&str>,
    force: bool,
) -> Result<String, String> {
    let (id, _) = run_subgraph_inner(
        http,
        project_root,
        graph,
        settings,
        from_node_id,
        previous_run_id,
        force,
        false,
    )
    .await?;
    Ok(id)
}

pub async fn run_subgraph_with_patch(
    http: &reqwest::Client,
    project_root: &Path,
    graph: &CanvasGraph,
    settings: &AppSettings,
    from_node_id: &str,
    previous_run_id: Option<&str>,
    force: bool,
) -> Result<GraphRunResult, String> {
    let (run_id, node_patches) = run_subgraph_inner(
        http,
        project_root,
        graph,
        settings,
        from_node_id,
        previous_run_id,
        force,
        true,
    )
    .await?;
    Ok(GraphRunResult {
        run_id,
        node_patches,
    })
}
