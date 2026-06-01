//! 本地 HTTP 桥：供对外 MCP stdio Server 调用，转发至前端 runHermesTool。

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::oneshot;

pub const CANVAS_MCP_BRIDGE_PORT: u16 = 14230;
const TOOLS_JSON: &str = include_str!("../../src/lib/hermes/mcp/canvasMcpTools.catalog.json");

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasMcpBridgeStatus {
    pub listening: bool,
    pub port: u16,
    pub frontend_ready: bool,
    pub project_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ToolCallBody {
    name: String,
    #[serde(default)]
    arguments: Value,
    #[serde(default)]
    source_message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
struct ToolCallResponse {
    ok: bool,
    message: String,
}

pub struct CanvasMcpBridge {
    pending: Mutex<HashMap<String, oneshot::Sender<ToolCallResponse>>>,
    frontend_ready: AtomicBool,
    project_path: Mutex<Option<String>>,
    started: AtomicBool,
}

impl Default for CanvasMcpBridge {
    fn default() -> Self {
        Self::new()
    }
}

impl CanvasMcpBridge {
    pub fn new() -> Self {
        Self {
            pending: Mutex::new(HashMap::new()),
            frontend_ready: AtomicBool::new(false),
            project_path: Mutex::new(None),
            started: AtomicBool::new(false),
        }
    }

    pub fn status(&self) -> CanvasMcpBridgeStatus {
        CanvasMcpBridgeStatus {
            listening: self.started.load(Ordering::Relaxed),
            port: CANVAS_MCP_BRIDGE_PORT,
            frontend_ready: self.frontend_ready.load(Ordering::Relaxed),
            project_path: self.project_path.lock().ok().and_then(|g| g.clone()),
        }
    }

    pub fn set_frontend_ready(&self, ready: bool) {
        self.frontend_ready.store(ready, Ordering::Relaxed);
    }

    pub fn set_project_path(&self, path: Option<String>) {
        if let Ok(mut g) = self.project_path.lock() {
            *g = path.filter(|s| !s.trim().is_empty());
        }
    }

    pub fn complete_tool_call(
        &self,
        request_id: &str,
        ok: bool,
        message: String,
    ) -> Result<(), String> {
        let tx = self
            .pending
            .lock()
            .map_err(|e| e.to_string())?
            .remove(request_id)
            .ok_or_else(|| format!("未知或已过期的 MCP 请求：{request_id}"))?;
        let _ = tx.send(ToolCallResponse { ok, message });
        Ok(())
    }

    async fn dispatch_tool_call(
        &self,
        app: &AppHandle,
        body: ToolCallBody,
    ) -> Result<ToolCallResponse, String> {
        if !self.frontend_ready.load(Ordering::Relaxed) {
            return Err(
                "CanvasFlow 前端未就绪：请先打开 App 并加载工程".into(),
            );
        }
        let request_id = uuid::Uuid::new_v4().to_string();
        let (tx, rx) = oneshot::channel();
        self.pending
            .lock()
            .map_err(|e| e.to_string())?
            .insert(request_id.clone(), tx);

        app.emit(
            "canvas-mcp-tool-call",
            serde_json::json!({
                "requestId": request_id,
                "name": body.name.trim(),
                "arguments": body.arguments,
                "sourceMessage": body.source_message,
            }),
        )
        .map_err(|e| format!("转发 MCP 工具调用失败：{e}"))?;

        match tokio::time::timeout(Duration::from_secs(180), rx).await {
            Ok(Ok(resp)) => Ok(resp),
            Ok(Err(_)) => {
                let _ = self.pending.lock().map(|mut g| g.remove(&request_id));
                Err("MCP 工具执行被取消".into())
            }
            Err(_) => {
                let _ = self.pending.lock().map(|mut g| g.remove(&request_id));
                Err("MCP 工具执行超时（180s）".into())
            }
        }
    }
}

pub fn start_canvas_mcp_bridge(app: AppHandle) {
    let bridge = app.state::<Arc<CanvasMcpBridge>>();
    if bridge.started.swap(true, Ordering::SeqCst) {
        return;
    }
    let bridge = bridge.inner().clone();
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(e) = run_http_server(app_handle, bridge).await {
            eprintln!("[canvas-mcp-bridge] {e}");
        }
    });
}

async fn run_http_server(app: AppHandle, bridge: Arc<CanvasMcpBridge>) -> Result<(), String> {
    let addr = format!("127.0.0.1:{}", CANVAS_MCP_BRIDGE_PORT);
    let listener = TcpListener::bind(&addr)
        .await
        .map_err(|e| format!("无法绑定 MCP 桥接端口 {addr}：{e}"))?;
    loop {
        let (mut stream, _) = listener
            .accept()
            .await
            .map_err(|e| format!("接受连接失败：{e}"))?;
        let app = app.clone();
        let bridge = bridge.clone();
        tauri::async_runtime::spawn(async move {
            let _ = handle_http_connection(&mut stream, &app, &bridge).await;
        });
    }
}

async fn handle_http_connection(
    stream: &mut tokio::net::TcpStream,
    app: &AppHandle,
    bridge: &Arc<CanvasMcpBridge>,
) -> Result<(), String> {
    let mut buf = vec![0u8; 65536];
    let n = stream
        .read(&mut buf)
        .await
        .map_err(|e| format!("读取请求失败：{e}"))?;
    if n == 0 {
        return Ok(());
    }
    let raw = String::from_utf8_lossy(&buf[..n]);
    let (status, body) = route_http(&raw, app, bridge).await;
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: application/json; charset=utf-8\r\nConnection: close\r\nContent-Length: {}\r\n\r\n{}",
        body.len(),
        body
    );
    stream
        .write_all(response.as_bytes())
        .await
        .map_err(|e| format!("写入响应失败：{e}"))?;
    Ok(())
}

async fn route_http(raw: &str, app: &AppHandle, bridge: &Arc<CanvasMcpBridge>) -> (u16, String) {
    let mut lines = raw.lines();
    let request_line = lines.next().unwrap_or("");
    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or("");
    let path = parts.next().unwrap_or("");

    let mut content_length = 0usize;
    for line in lines {
        if line.is_empty() {
            break;
        }
        if let Some(v) = line
            .strip_prefix("Content-Length:")
            .or_else(|| line.strip_prefix("content-length:"))
        {
            content_length = v.trim().parse().unwrap_or(0);
        }
    }

    let body_start = raw.find("\r\n\r\n").map(|i| i + 4).unwrap_or(raw.len());
    let body_raw = if content_length > 0 && raw.len() >= body_start + content_length {
        &raw[body_start..body_start + content_length]
    } else {
        &raw[body_start..]
    };

    match (method, path) {
        ("GET", "/health") => {
            let status = bridge.status();
            (200, serde_json::to_string(&status).unwrap_or_else(|_| "{}".into()))
        }
        ("GET", "/tools") => (200, TOOLS_JSON.to_string()),
        ("POST", "/tools/call") => {
            let parsed: Result<ToolCallBody, _> = serde_json::from_str(body_raw.trim());
            match parsed {
                Ok(body) if body.name.trim().is_empty() => {
                    json_error(400, "缺少工具名 name")
                }
                Ok(body) => match bridge.dispatch_tool_call(app, body).await {
                    Ok(resp) => (200, serde_json::to_string(&resp).unwrap()),
                    Err(e) => json_error(503, &e),
                },
                Err(e) => json_error(400, &format!("JSON 解析失败：{e}")),
            }
        }
        _ => json_error(404, "Not Found"),
    }
}

fn json_error(status: u16, message: &str) -> (u16, String) {
    (
        status,
        serde_json::json!({ "ok": false, "message": message }).to_string(),
    )
}
