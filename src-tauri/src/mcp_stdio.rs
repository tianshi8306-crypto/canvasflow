//! 最小 MCP stdio 客户端（JSON-RPC 按行），用于连接外接 MCP Server。

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

pub const MCP_PROTOCOL_VERSION: &str = "2024-11-05";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HermesMcpServerConfig {
    pub id: String,
    pub label: String,
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
}

fn default_enabled() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpToolDescriptor {
    pub name: String,
    pub description: Option<String>,
    #[serde(default)]
    pub input_schema: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpCallToolResult {
    pub content: String,
    pub is_error: bool,
}

struct McpStdioSession {
    child: Child,
    reader: BufReader<std::process::ChildStdout>,
    next_id: u64,
}

impl McpStdioSession {
    fn spawn(config: &HermesMcpServerConfig) -> Result<Self, String> {
        let command = config.command.trim();
        if command.is_empty() {
            return Err("MCP 命令不能为空".into());
        }
        let mut cmd = Command::new(command);
        cmd.args(&config.args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit());
        for (k, v) in &config.env {
            cmd.env(k, v);
        }
        let mut child = cmd
            .spawn()
            .map_err(|e| format!("启动 MCP 进程失败（{}）：{e}", command))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "无法读取 MCP stdout".to_string())?;
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "无法写入 MCP stdin".to_string())?;

        let mut session = Self {
            child,
            reader: BufReader::new(stdout),
            next_id: 1,
        };
        session.child.stdin = Some(stdin);
        session.initialize()?;
        Ok(session)
    }

    fn initialize(&mut self) -> Result<(), String> {
        let params = serde_json::json!({
            "protocolVersion": MCP_PROTOCOL_VERSION,
            "capabilities": {},
            "clientInfo": {
                "name": "canvasflow-hermes",
                "version": env!("CARGO_PKG_VERSION"),
            }
        });
        let _ = self.request("initialize", Some(params), Duration::from_secs(30))?;
        self.notify("notifications/initialized", None)?;
        Ok(())
    }

    fn notify(&mut self, method: &str, params: Option<Value>) -> Result<(), String> {
        let msg = serde_json::json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params.unwrap_or(Value::Object(Default::default())),
        });
        self.write_line(&msg)
    }

    fn request(
        &mut self,
        method: &str,
        params: Option<Value>,
        timeout: Duration,
    ) -> Result<Value, String> {
        let id = self.next_id;
        self.next_id += 1;
        let msg = serde_json::json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params.unwrap_or(Value::Object(Default::default())),
        });
        self.write_line(&msg)?;
        self.read_response(id, timeout)
    }

    fn write_line(&mut self, value: &Value) -> Result<(), String> {
        let stdin = self
            .child
            .stdin
            .as_mut()
            .ok_or_else(|| "MCP stdin 已关闭".to_string())?;
        let line = serde_json::to_string(value).map_err(|e| e.to_string())?;
        stdin
            .write_all(line.as_bytes())
            .map_err(|e| format!("写入 MCP 失败：{e}"))?;
        stdin
            .write_all(b"\n")
            .map_err(|e| format!("写入 MCP 失败：{e}"))?;
        stdin.flush().map_err(|e| format!("写入 MCP 失败：{e}"))?;
        Ok(())
    }

    fn read_response(&mut self, expect_id: u64, timeout: Duration) -> Result<Value, String> {
        let deadline = Instant::now() + timeout;
        loop {
            if Instant::now() > deadline {
                return Err("MCP 响应超时".into());
            }
            let mut line = String::new();
            self.reader
                .read_line(&mut line)
                .map_err(|e| format!("读取 MCP 输出失败：{e}"))?;
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            let parsed: Value =
                serde_json::from_str(trimmed).map_err(|e| format!("MCP JSON 解析失败：{e}"))?;
            if parsed.get("method").is_some() && parsed.get("id").is_none() {
                continue;
            }
            let resp_id = parsed.get("id").and_then(|v| v.as_u64());
            if resp_id != Some(expect_id) {
                continue;
            }
            if let Some(err) = parsed.get("error") {
                return Err(format!("MCP 错误：{err}"));
            }
            return parsed
                .get("result")
                .cloned()
                .ok_or_else(|| "MCP 响应缺少 result".to_string());
        }
    }

    fn list_tools(&mut self) -> Result<Vec<McpToolDescriptor>, String> {
        let result = self.request("tools/list", None, Duration::from_secs(20))?;
        let tools = result
            .get("tools")
            .and_then(|t| t.as_array())
            .ok_or_else(|| "tools/list 响应格式无效".to_string())?;
        let mut out = Vec::new();
        for t in tools {
            let name = t
                .get("name")
                .and_then(|n| n.as_str())
                .unwrap_or("")
                .trim()
                .to_string();
            if name.is_empty() {
                continue;
            }
            let description = t
                .get("description")
                .and_then(|d| d.as_str())
                .map(|s| s.to_string());
            let input_schema = t
                .get("inputSchema")
                .cloned()
                .unwrap_or(Value::Object(Default::default()));
            out.push(McpToolDescriptor {
                name,
                description,
                input_schema,
            });
        }
        Ok(out)
    }

    fn call_tool(&mut self, name: &str, arguments: Value) -> Result<McpCallToolResult, String> {
        let params = serde_json::json!({
            "name": name,
            "arguments": arguments,
        });
        let result = self.request("tools/call", Some(params), Duration::from_secs(120))?;
        let is_error = result
            .get("isError")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        let content = extract_tool_content(&result);
        Ok(McpCallToolResult {
            content,
            is_error,
        })
    }
}

impl Drop for McpStdioSession {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

fn extract_tool_content(result: &Value) -> String {
    let Some(arr) = result.get("content").and_then(|c| c.as_array()) else {
        return result.to_string();
    };
    let mut parts = Vec::new();
    for item in arr {
        if let Some(text) = item.get("text").and_then(|t| t.as_str()) {
            parts.push(text.to_string());
        } else {
            parts.push(item.to_string());
        }
    }
    if parts.is_empty() {
        result.to_string()
    } else {
        parts.join("\n")
    }
}

pub fn mcp_list_tools(config: &HermesMcpServerConfig) -> Result<Vec<McpToolDescriptor>, String> {
    let mut session = McpStdioSession::spawn(config)?;
    session.list_tools()
}

pub fn mcp_call_tool(
    config: &HermesMcpServerConfig,
    tool_name: &str,
    arguments: Value,
) -> Result<McpCallToolResult, String> {
    let mut session = McpStdioSession::spawn(config)?;
    session.call_tool(tool_name, arguments)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_content_text() {
        let v = serde_json::json!({
            "content": [{ "type": "text", "text": "hello" }]
        });
        assert_eq!(extract_tool_content(&v), "hello");
    }
}
