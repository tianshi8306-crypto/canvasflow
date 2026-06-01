use crate::mcp_stdio::{
    mcp_call_tool, mcp_list_tools, HermesMcpServerConfig, McpCallToolResult, McpToolDescriptor,
};
use crate::settings::{load_settings, AppSettings};
use serde_json::Value;
use tauri::AppHandle;

fn find_server<'a>(settings: &'a AppSettings, server_id: &str) -> Result<&'a HermesMcpServerConfig, String> {
    let id = server_id.trim();
    settings
        .hermes_mcp_servers
        .iter()
        .find(|s| s.id == id)
        .ok_or_else(|| format!("未找到 MCP 服务：{id}"))
}

#[tauri::command]
pub fn hermes_mcp_list_tools(
    app: AppHandle,
    server_id: String,
) -> Result<Vec<McpToolDescriptor>, String> {
    let settings = load_settings(&app)?;
    let server = find_server(&settings, &server_id)?;
    if !server.enabled {
        return Err("该 MCP 服务已禁用".into());
    }
    mcp_list_tools(server)
}

#[tauri::command]
pub fn hermes_mcp_call_tool(
    app: AppHandle,
    server_id: String,
    tool_name: String,
    arguments: Option<Value>,
) -> Result<McpCallToolResult, String> {
    let settings = load_settings(&app)?;
    let server = find_server(&settings, &server_id)?;
    if !server.enabled {
        return Err("该 MCP 服务已禁用".into());
    }
    let args = arguments.unwrap_or(Value::Object(Default::default()));
    mcp_call_tool(server, tool_name.trim(), args)
}

#[tauri::command]
pub fn hermes_mcp_probe_server(config: HermesMcpServerConfig) -> Result<usize, String> {
    let tools = mcp_list_tools(&config)?;
    Ok(tools.len())
}
