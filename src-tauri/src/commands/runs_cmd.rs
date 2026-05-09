use crate::db;

#[tauri::command]
pub fn list_runs(project_path: String, limit: Option<i64>) -> Result<Vec<db::RunSummary>, String> {
    let path = std::path::PathBuf::from(project_path);
    let conn = db::open_run_db(&path)?;
    db::list_runs(&conn, limit.unwrap_or(20))
}

#[tauri::command]
pub fn list_run_events(project_path: String, run_id: String) -> Result<Vec<db::RunEventRow>, String> {
    let path = std::path::PathBuf::from(project_path);
    let conn = db::open_run_db(&path)?;
    db::list_run_events(&conn, &run_id)
}

#[tauri::command]
pub fn append_agent_event(
    project_path: String,
    run_id: String,
    node_id: String,
    agent_name: String,
    phase: String,
    elapsed_ms: i64,
    error: Option<String>,
) -> Result<(), String> {
    let path = std::path::PathBuf::from(project_path);
    let conn = db::open_run_db(&path)?;
    let payload = serde_json::json!({
        "agentName": agent_name,
        "phase": phase,
        "elapsedMs": elapsed_ms,
        "error": error,
    });
    let node = node_id.trim();
    let node_id_opt = if node.is_empty() { None } else { Some(node) };
    db::log_event(&conn, &run_id, node_id_opt, "agent_phase", &payload)
}

/// 将单个节点 Agent 事件写入 run_events（支持无 run_id 的即席写入，自动创建临时 run）
#[tauri::command]
pub fn append_node_agent_event(
    project_path: String,
    node_id: String,
    agent_name: String,
    phase: String,
    elapsed_ms: i64,
    error: Option<String>,
    run_id: Option<String>,
) -> Result<(), String> {
    let path = std::path::PathBuf::from(project_path);
    let conn = db::open_run_db(&path)?;

    // 若未提供 run_id，创建临时单节点 run
    let actual_run_id = match &run_id {
        Some(rid) if !rid.is_empty() => rid.clone(),
        _ => {
            let tmp_run_id = uuid::Uuid::new_v4().to_string();
            db::insert_run(&conn, &tmp_run_id)?;
            db::mark_run_running(&conn, &tmp_run_id)?;
            tmp_run_id
        }
    };

    let payload = serde_json::json!({
        "agentName": agent_name,
        "phase": phase,
        "elapsedMs": elapsed_ms,
        "error": error,
    });
    let node = node_id.trim();
    let node_id_opt = if node.is_empty() { None } else { Some(node) };
    db::log_event(&conn, &actual_run_id, node_id_opt, "agent_phase", &payload)
}
