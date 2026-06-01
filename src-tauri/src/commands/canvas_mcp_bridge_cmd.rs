use crate::canvas_mcp_bridge::{CanvasMcpBridge, CanvasMcpBridgeStatus};
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub fn canvas_mcp_bridge_status(bridge: State<'_, Arc<CanvasMcpBridge>>) -> CanvasMcpBridgeStatus {
    bridge.status()
}

#[tauri::command]
pub fn canvas_mcp_bridge_set_context(
    bridge: State<'_, Arc<CanvasMcpBridge>>,
    project_path: Option<String>,
    frontend_ready: bool,
) -> Result<(), String> {
    bridge.set_project_path(project_path);
    bridge.set_frontend_ready(frontend_ready);
    Ok(())
}

#[tauri::command]
pub fn canvas_mcp_tool_result(
    bridge: State<'_, Arc<CanvasMcpBridge>>,
    request_id: String,
    ok: bool,
    message: String,
) -> Result<(), String> {
    bridge.complete_tool_call(request_id.trim(), ok, message)
}
