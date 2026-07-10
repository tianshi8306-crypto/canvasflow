use crate::db;
use crate::graph::{downstream_descendants, topological_order, CanvasGraph};
use crate::settings::AppSettings;
use serde_json::json;
use std::collections::{HashMap, HashSet};
use std::path::Path;

use super::graph_flow::node_by_id;
use super::shared::{exec_node_loop, recover_run_outputs, recover_run_succeeded};
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
    let order = topological_order(graph)?;
    let run_id = uuid::Uuid::new_v4().to_string();

    let conn = db::open_run_db(project_root)?;
    db::insert_run(&conn, &run_id)?;
    db::mark_run_running(&conn, &run_id)?;
    db::log_event(
        &conn,
        &run_id,
        None,
        "run_start",
        &json!({ "nodeCount": graph.nodes.len() }),
    )?;

    let include_set: HashSet<String> = graph.nodes.iter().map(|n| n.id.clone()).collect();

    let mut script_patches: Vec<(String, serde_json::Value)> = Vec::new();

    let (_outputs, any_node_failed) = exec_node_loop(
        http,
        project_root,
        graph,
        settings,
        &order,
        None,
        &include_set,
        &run_id,
        true,
        json!({ "nodeCount": graph.nodes.len() }),
        &mut script_patches,
        None,
        None,
    )
    .await?;

    let node_patches: Vec<NodeDataPatch> = script_patches
        .into_iter()
        .map(|(node_id, data_patch)| NodeDataPatch { node_id, data_patch })
        .collect();

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

async fn run_subgraph_inner(
    http: &reqwest::Client,
    project_root: &Path,
    graph: &CanvasGraph,
    settings: &AppSettings,
    from_node_id: &str,
    previous_run_id: Option<&str>,
    force: bool,
    collect_patches: bool,
    app: Option<&tauri::AppHandle>,
) -> Result<(String, Vec<NodeDataPatch>), String> {
    let order = topological_order(graph)?;
    if node_by_id(graph, from_node_id).is_none() {
        return Err(format!("找不到节点 {}", from_node_id));
    }

    let mut include: HashSet<String> = downstream_descendants(graph, from_node_id);
    include.insert(from_node_id.to_string());
    let order: Vec<String> = order.into_iter().filter(|id| include.contains(id)).collect();

    let run_id = uuid::Uuid::new_v4().to_string();
    let conn = db::open_run_db(project_root)?;

    let (succeeded_before, _output_before) = if force {
        (HashSet::new(), HashMap::new())
    } else if let Some(prev) = previous_run_id {
        (recover_run_succeeded(&conn, prev)?, recover_run_outputs(&conn, prev)?)
    } else {
        (HashSet::new(), HashMap::new())
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

    let mut script_patches: Vec<(String, serde_json::Value)> = Vec::new();

    let (_outputs, any_node_failed) = exec_node_loop(
        http,
        project_root,
        graph,
        settings,
        &order,
        Some(&succeeded_before),
        &include,
        &run_id,
        collect_patches,
        json!({
            "nodeCount": order.len(),
            "subgraphFromNodeId": from_node_id,
            "previousRunId": previous_run_id,
            "force": force,
        }),
        &mut script_patches,
        Some(&_output_before),
        app,
    )
    .await?;

    let node_patches: Vec<NodeDataPatch> = script_patches
        .into_iter()
        .map(|(node_id, data_patch)| NodeDataPatch { node_id, data_patch })
        .collect();

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

pub async fn run_subgraph(
    http: &reqwest::Client,
    project_root: &Path,
    graph: &CanvasGraph,
    settings: &AppSettings,
    from_node_id: &str,
    previous_run_id: Option<&str>,
    force: bool,
    app: Option<&tauri::AppHandle>,
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
        app,
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
    app: Option<&tauri::AppHandle>,
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
        app,
    )
    .await?;
    Ok(GraphRunResult { run_id, node_patches })
}