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
