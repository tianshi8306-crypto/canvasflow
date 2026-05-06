# CanvasFlow Hermes Agent 引入方案 — Cursor 执行手册

> 每一步都是精确的文件路径 + 代码 + 验证命令。按步骤顺序执行，不要跳步。
>
> 版本：v2.0 · 2026-04-30

---

## 前置条件

执行前确认以下条件全部满足，不满足则停止：

- [ ] `projectStore.ts` 已拆分为独立 store（canvasStore / workflowStore / selectionStore 等），单文件不超过 300 行
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml` 全部通过
- [ ] `npm run typecheck` 无错误
- [ ] `npm run test` 全部通过

---

## Step 1：新增 LLM 响应类型

**文件**：`src-tauri/src/executor/types.rs`

在文件末尾追加：

```rust
/// LLM 响应的完整解析结果（含 tool_calls）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmResponse {
    /// 文本内容（可能为空）
    pub content: Option<String>,
    /// 工具调用列表（可能为空）
    pub tool_calls: Vec<ToolCall>,
    /// 结束原因：stop / tool_calls / length
    pub finish_reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolCall {
    pub id: String,
    /// 工具名（对应 OpenAI function name）
    pub name: String,
    /// 工具参数（已解析为 JSON Value）
    pub arguments: serde_json::Value,
}
```

**验证**：`cargo check --manifest-path src-tauri/Cargo.toml` 编译通过。

---

## Step 2：llm.rs 新增完整响应解析函数

**文件**：`src-tauri/src/executor/llm.rs`

在 `openai_chat_completion` 函数**之后**、`pick_provider` 函数**之前**，新增：

```rust
/// 与 openai_chat_completion 相同的调用逻辑，但返回完整的 LlmResponse（含 tool_calls）。
/// 不破坏现有函数签名。
pub async fn openai_chat_completion_full(
    http: &reqwest::Client,
    settings: &AppSettings,
    messages: serde_json::Value,
    tools: Option<serde_json::Value>,
    extra_params: &serde_json::Value,
) -> Result<super::types::LlmResponse, String> {
    use super::types::{LlmResponse, ToolCall};

    let provider_id_override = extra_params
        .get("providerId")
        .and_then(|v| v.as_str())
        .map(|s| s.trim())
        .filter(|s| !s.is_empty());
    let provider = if let Some(pid) = provider_id_override {
        settings
            .providers
            .iter()
            .find(|p| p.enabled && p.id == pid)
            .cloned()
            .ok_or_else(|| format!("所选 Provider 不可用：{}", pid))?
    } else {
        pick_provider(settings)?
    };
    let api_key = vault::get_api_key(&provider.id)?
        .ok_or_else(|| format!("未配置 API Key：{}", provider.label))?;
    let model_override = extra_params
        .get("model")
        .and_then(|v| v.as_str())
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());

    let mut body = json!({
        "model": model_override.unwrap_or_else(|| provider.model.clone()),
        "messages": messages,
    });
    // 插入 tools 定义
    if let Some(tools_def) = tools {
        if let Some(obj) = body.as_object_mut() {
            obj.insert("tools".into(), tools_def);
            obj.insert("tool_choice".into(), json!("auto"));
        }
    }
    // 合并 extra_params
    if let Some(obj) = body.as_object_mut() {
        if let serde_json::Value::Object(p) = extra_params.clone() {
            for (k, v) in p {
                if k != "model" && k != "messages" && k != "providerId" && k != "tools" && k != "tool_choice" {
                    obj.insert(k, v);
                }
            }
        }
    }

    let url = format!(
        "{}/chat/completions",
        provider.base_url.trim_end_matches('/')
    );

    let resp = http
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = resp.status();
    let text = resp.text().await.map_err(|e| e.to_string())?;
    let parsed: serde_json::Value =
        serde_json::from_str(&text).unwrap_or_else(|_| json!({ "raw": text }));

    if !status.is_success() {
        return Err(format!(
            "LLM API 失败: {}",
            serde_json::to_string(&parsed).unwrap_or_default()
        ));
    }

    // 解析 content
    let content = parsed
        .pointer("/choices/0/message/content")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // 解析 finish_reason
    let finish_reason = parsed
        .pointer("/choices/0/finish_reason")
        .and_then(|v| v.as_str())
        .unwrap_or("stop")
        .to_string();

    // 解析 tool_calls
    let tool_calls: Vec<ToolCall> = parsed
        .pointer("/choices/0/message/tool_calls")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|tc| {
                    let id = tc.get("id")?.as_str()?.to_string();
                    let name = tc
                        .pointer("/function/name")?
                        .as_str()?
                        .to_string();
                    let args_str = tc
                        .pointer("/function/arguments")?
                        .as_str()
                        .unwrap_or("{}");
                    let arguments: serde_json::Value =
                        serde_json::from_str(args_str).unwrap_or(json!({}));
                    Some(ToolCall { id, name, arguments })
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(LlmResponse {
        content,
        tool_calls,
        finish_reason,
    })
}
```

**验证**：`cargo check --manifest-path src-tauri/Cargo.toml` 编译通过。

---

## Step 3：llm.rs 新增流式 SSE 函数

**文件**：`src-tauri/Cargo.toml`

在 `[dependencies]` 中追加：

```toml
futures-util = "0.3"
eventsource-stream = "0.2"
```

**文件**：`src-tauri/src/executor/llm.rs`

在 `openai_chat_completion_full` 函数之后追加：

```rust
/// 流式调用 LLM，通过 Tauri Emitter 实时推送 token。
/// 返回完整的 LlmResponse（收集完毕后）。
pub async fn openai_chat_completion_stream(
    http: &reqwest::Client,
    app: &tauri::AppHandle,
    session_id: &str,
    settings: &AppSettings,
    messages: serde_json::Value,
    tools: Option<serde_json::Value>,
    extra_params: &serde_json::Value,
) -> Result<super::types::LlmResponse, String> {
    use super::types::{LlmResponse, ToolCall};
    use eventsource_stream::Eventsource;
    use futures_util::StreamExt;

    let provider_id_override = extra_params
        .get("providerId")
        .and_then(|v| v.as_str())
        .map(|s| s.trim())
        .filter(|s| !s.is_empty());
    let provider = if let Some(pid) = provider_id_override {
        settings
            .providers
            .iter()
            .find(|p| p.enabled && p.id == pid)
            .cloned()
            .ok_or_else(|| format!("所选 Provider 不可用：{}", pid))?
    } else {
        pick_provider(settings)?
    };
    let api_key = vault::get_api_key(&provider.id)?
        .ok_or_else(|| format!("未配置 API Key：{}", provider.label))?;
    let model_override = extra_params
        .get("model")
        .and_then(|v| v.as_str())
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());

    let mut body = json!({
        "model": model_override.unwrap_or_else(|| provider.model.clone()),
        "messages": messages,
        "stream": true,
    });
    if let Some(tools_def) = tools {
        if let Some(obj) = body.as_object_mut() {
            obj.insert("tools".into(), tools_def);
            obj.insert("tool_choice".into(), json!("auto"));
        }
    }
    if let Some(obj) = body.as_object_mut() {
        if let serde_json::Value::Object(p) = extra_params.clone() {
            for (k, v) in p {
                if k != "model" && k != "messages" && k != "providerId"
                    && k != "tools" && k != "tool_choice" && k != "stream"
                {
                    obj.insert(k, v);
                }
            }
        }
    }

    let url = format!(
        "{}/chat/completions",
        provider.base_url.trim_end_matches('/')
    );

    let resp = http
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = resp.status();
    if !status.is_success() {
        let text = resp.text().await.map_err(|e| e.to_string())?;
        return Err(format!("LLM 流式调用失败({}): {}", status, text));
    }

    // 降级：如果响应不是 SSE（某些 Provider 不支持流式），回退到全量
    let content_type = resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if !content_type.contains("text/event-stream") {
        let text = resp.text().await.map_err(|e| e.to_string())?;
        let parsed: serde_json::Value =
            serde_json::from_str(&text).unwrap_or_else(|_| json!({ "raw": text }));
        let ct = parsed
            .pointer("/choices/0/message/content")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        return Ok(LlmResponse {
            content: ct,
            tool_calls: Vec::new(),
            finish_reason: "stop".into(),
        });
    }

    // SSE 流式读取
    let mut collected_content = String::new();
    let mut collected_tool_calls: Vec<ToolCall> = Vec::new();
    let mut finish_reason = "stop".to_string();

    let byte_stream = resp.bytes_stream();
    let mut event_stream = byte_stream.eventsource();

    while let Some(event) = event_stream.next().await {
        let event = event.map_err(|e| format!("SSE 读取错误：{}", e))?;
        if event.data == "[DONE]" {
            break;
        }
        let chunk: serde_json::Value =
            serde_json::from_str(&event.data).unwrap_or_continue();
        // 推送 delta token
        if let Some(delta_content) = chunk.pointer("/choices/0/delta/content") {
            if let Some(token) = delta_content.as_str() {
                collected_content.push_str(token);
                let _ = app.emit(
                    "agent:token",
                    json!({ "sessionId": session_id, "delta": token }),
                );
            }
        }
        // 收集 tool_calls delta
        if let Some(tc_deltas) = chunk
            .pointer("/choices/0/delta/tool_calls")
            .and_then(|v| v.as_array())
        {
            for tc_delta in tc_deltas {
                let idx = tc_delta
                    .get("index")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0) as usize;
                while collected_tool_calls.len() <= idx {
                    collected_tool_calls.push(ToolCall {
                        id: String::new(),
                        name: String::new(),
                        arguments: json!({}),
                    });
                }
                if let Some(id) = tc_delta.get("id").and_then(|v| v.as_str()) {
                    collected_tool_calls[idx].id = id.to_string();
                }
                if let Some(name) = tc_delta.pointer("/function/name").and_then(|v| v.as_str()) {
                    collected_tool_calls[idx].name = name.to_string();
                }
                if let Some(args) = tc_delta.pointer("/function/arguments").and_then(|v| v.as_str())
                {
                    // 流式追加参数片段
                    if collected_tool_calls[idx].arguments.is_object()
                        && collected_tool_calls[idx].arguments.as_object().map(|o| o.is_empty()).unwrap_or(true)
                    {
                        // 尝试解析完整 JSON
                        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(args) {
                            collected_tool_calls[idx].arguments = parsed;
                        } else {
                            // 片段，先存字符串
                            collected_tool_calls[idx].arguments = json!(args);
                        }
                    }
                }
            }
        }
        // 收集 finish_reason
        if let Some(fr) = chunk
            .pointer("/choices/0/finish_reason")
            .and_then(|v| v.as_str())
        {
            finish_reason = fr.to_string();
        }
    }

    // 最终解析 tool_calls 的 arguments
    for tc in &mut collected_tool_calls {
        if tc.arguments.is_string() {
            let s = tc.arguments.as_str().unwrap_or("{}");
            tc.arguments = serde_json::from_str(s).unwrap_or(json!({}));
        }
    }

    let content_opt = if collected_content.is_empty() {
        None
    } else {
        Some(collected_content)
    };

    Ok(LlmResponse {
        content: content_opt,
        tool_calls: collected_tool_calls,
        finish_reason,
    })
}
```

**验证**：`cargo check --manifest-path src-tauri/Cargo.toml` 编译通过。

---

## Step 4：更新 executor/mod.rs 导出

**文件**：`src-tauri/src/executor/mod.rs`

替换为：

```rust
//! 画布 DAG 执行：拓扑运行、脚本解析、LLM、FFmpeg 拼接等。

mod agent;
mod agent_tools;
mod engine;
mod ffmpeg;
mod graph_flow;
mod llm;
mod script_node;
mod script_parse;
mod types;

pub use agent::{run_agent_loop, AgentConfig, ToolContext, ToolExecutor};
pub use agent_tools::default_tools;
pub use engine::{run_graph, run_graph_with_patch, run_subgraph, run_subgraph_with_patch};
pub use llm::openai_chat_completion;
pub use llm::openai_chat_completion_full;
pub use llm::openai_chat_completion_stream;
pub use types::{GraphRunResult, LlmResponse, NodeDataPatch, ToolCall};
```

**验证**：此时编译会报 `agent` 和 `agent_tools` 模块不存在，先忽略，后续步骤创建。

---

## Step 5：DB 新增 agent session 表

**文件**：`src-tauri/src/db.rs`

### 5.1 在 `init_schema` 函数的 `execute_batch` 中，`CREATE TABLE IF NOT EXISTS assets` 语句**之后**追加：

```sql
CREATE TABLE IF NOT EXISTS agent_sessions (
    id TEXT PRIMARY KEY,
    project_path TEXT NOT NULL,
    title TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS agent_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('system', 'user', 'assistant', 'tool')),
    content TEXT,
    tool_call_id TEXT,
    tool_calls_json TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_agent_messages_session
    ON agent_messages(session_id, id);
```

### 5.2 在 `db.rs` 文件末尾（`mod tests` 之前）追加 CRUD 函数：

```rust
// ==================== Agent Session / Message CRUD ====================

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummary {
    pub id: String,
    pub project_path: String,
    pub title: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentMessageRow {
    pub id: i64,
    pub session_id: String,
    pub role: String,
    pub content: Option<String>,
    pub tool_call_id: Option<String>,
    pub tool_calls_json: Option<String>,
    pub created_at: String,
}

pub fn create_session(
    conn: &Connection,
    id: &str,
    project_path: &str,
    title: Option<&str>,
) -> Result<(), String> {
    let ts = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO agent_sessions (id, project_path, title, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)",
        params![id, project_path, title, ts],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn list_sessions(
    conn: &Connection,
    project_path: &str,
) -> Result<Vec<SessionSummary>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, project_path, title, created_at, updated_at
             FROM agent_sessions
             WHERE project_path = ?1
             ORDER BY updated_at DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![project_path], |row| {
            Ok(SessionSummary {
                id: row.get(0)?,
                project_path: row.get(1)?,
                title: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

pub fn append_agent_message(
    conn: &Connection,
    session_id: &str,
    role: &str,
    content: Option<&str>,
    tool_call_id: Option<&str>,
    tool_calls_json: Option<&str>,
) -> Result<(), String> {
    let ts = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO agent_messages (session_id, role, content, tool_call_id, tool_calls_json, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![session_id, role, content, tool_call_id, tool_calls_json, ts],
    )
    .map_err(|e| e.to_string())?;
    // 更新 session 的 updated_at
    conn.execute(
        "UPDATE agent_sessions SET updated_at = ?1 WHERE id = ?2",
        params![ts, session_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_agent_messages(
    conn: &Connection,
    session_id: &str,
) -> Result<Vec<AgentMessageRow>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, session_id, role, content, tool_call_id, tool_calls_json, created_at
             FROM agent_messages
             WHERE session_id = ?1
             ORDER BY id ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![session_id], |row| {
            Ok(AgentMessageRow {
                id: row.get(0)?,
                session_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                tool_call_id: row.get(4)?,
                tool_calls_json: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

pub fn delete_session(conn: &Connection, session_id: &str) -> Result<(), String> {
    conn.execute("DELETE FROM agent_messages WHERE session_id = ?1", params![session_id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM agent_sessions WHERE id = ?1", params![session_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
```

**验证**：`cargo check --manifest-path src-tauri/Cargo.toml` 编译通过。

---

## Step 6：settings.rs 新增 Agent 配置

**文件**：`src-tauri/src/settings.rs`

### 6.1 在 `ImageModelConfig` 结构体之后追加：

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSettings {
    /// Agent 专用 Provider ID（为空则使用默认 Provider）
    #[serde(default)]
    pub agent_provider_id: Option<String>,
    /// Agent 专用模型（为空则使用 Provider 默认模型）
    #[serde(default)]
    pub agent_model: Option<String>,
    /// 最大迭代次数
    #[serde(default = "default_max_iterations")]
    pub max_iterations: u32,
    /// 是否启用 Agent 功能
    #[serde(default)]
    pub agent_enabled: bool,
}

fn default_max_iterations() -> u32 {
    10
}

impl Default for AgentSettings {
    fn default() -> Self {
        Self {
            agent_provider_id: None,
            agent_model: None,
            max_iterations: 10,
            agent_enabled: true,
        }
    }
}
```

### 6.2 在 `AppSettings` 结构体中，`abort_workflow_on_failure` 字段之后追加：

```rust
    #[serde(default)]
    pub agent: AgentSettings,
```

### 6.3 在 `AppSettings::default()` 中追加：

```rust
            agent: AgentSettings::default(),
```

**验证**：`cargo check --manifest-path src-tauri/Cargo.toml` 编译通过。

---

## Step 7：新建 agent.rs — Agent Loop

**文件**：`src-tauri/src/executor/agent.rs`（新建）

```rust
use crate::db;
use crate::executor::llm::{openai_chat_completion_stream, openai_chat_completion_full};
use crate::executor::types::ToolCall;
use crate::settings::AppSettings;
use serde_json::json;
use std::path::Path;
use tauri::Emitter;

// ==================== Trait ====================

/// 工具执行器的 trait —— 每个工具实现它
pub trait ToolExecutor: Send + Sync {
    /// 工具名（与 OpenAI function name 一致）
    fn name(&self) -> &str;
    /// JSON Schema 格式的参数定义
    fn parameters_schema(&self) -> serde_json::Value;
    /// 工具描述（发送给 LLM）
    fn description(&self) -> &str;
    /// 执行工具，返回结果文本
    fn execute(&self, args: &serde_json::Value, ctx: &ToolContext) -> Result<String, String>;
}

/// 工具执行的上下文
pub struct ToolContext {
    pub http: reqwest::Client,
    pub app: tauri::AppHandle,
    pub project_path: std::path::PathBuf,
    pub settings: AppSettings,
}

// ==================== Config ====================

/// Agent 运行配置
pub struct AgentConfig {
    pub session_id: String,
    pub project_path: String,
    pub max_iterations: u32,
    pub agent_provider_id: Option<String>,
    pub agent_model: Option<String>,
}

// ==================== Agent Loop ====================

/// 构造 OpenAI tools 参数
fn build_tools_schema(tools: &[Box<dyn ToolExecutor>]) -> serde_json::Value {
    let defs: Vec<serde_json::Value> = tools
        .iter()
        .map(|t| {
            json!({
                "type": "function",
                "function": {
                    "name": t.name(),
                    "description": t.description(),
                    "parameters": t.parameters_schema(),
                }
            })
        })
        .collect();
    json!(defs)
}

/// 将 DB 中的消息历史转为 OpenAI messages 格式
fn history_to_messages(history: &[db::AgentMessageRow]) -> serde_json::Value {
    let mut msgs: Vec<serde_json::Value> = Vec::new();
    for msg in history {
        match msg.role.as_str() {
            "system" | "user" => {
                msgs.push(json!({
                    "role": msg.role,
                    "content": msg.content.clone().unwrap_or_default(),
                }));
            }
            "assistant" => {
                let mut m = json!({
                    "role": "assistant",
                    "content": msg.content.clone(),
                });
                if let Some(ref tc_json) = msg.tool_calls_json {
                    if let Ok(tc_arr) = serde_json::from_str::<Vec<serde_json::Value>>(tc_json) {
                        m.as_object_mut().unwrap().insert(
                            "tool_calls".into(),
                            json!(tc_arr),
                        );
                    }
                }
                msgs.push(m);
            }
            "tool" => {
                msgs.push(json!({
                    "role": "tool",
                    "tool_call_id": msg.tool_call_id.clone().unwrap_or_default(),
                    "content": msg.content.clone().unwrap_or_default(),
                }));
            }
            _ => {}
        }
    }
    json!(msgs)
}

/// Agent 主循环
pub async fn run_agent_loop(
    http: &reqwest::Client,
    app: &tauri::AppHandle,
    settings: &AppSettings,
    config: &AgentConfig,
    tools: &[Box<dyn ToolExecutor>],
    user_message: &str,
) -> Result<String, String> {
    let project_path = Path::new(&config.project_path);
    let conn = db::open_run_db(project_path)?;

    // 1. 追加用户消息到 DB
    db::append_agent_message(
        &conn,
        &config.session_id,
        "user",
        Some(user_message),
        None,
        None,
    )?;

    // 2. 读取完整历史
    let history = db::get_agent_messages(&conn, &config.session_id)?;
    let mut messages_json = history_to_messages(&history);

    // 3. 构造工具 schema
    let tools_schema = build_tools_schema(tools);
    let extra = json!({
        "providerId": config.agent_provider_id,
        "model": config.agent_model,
    });

    // 4. Agent Loop
    let mut iteration = 0u32;
    let mut final_text = String::new();

    loop {
        iteration += 1;
        if iteration > config.max_iterations {
            final_text = "[Agent] 达到最大迭代次数，停止执行。".into();
            break;
        }

        // 4a. 调用 LLM（流式）
        let response = openai_chat_completion_stream(
            http,
            app,
            &config.session_id,
            settings,
            messages_json.clone(),
            Some(tools_schema.clone()),
            &extra,
        )
        .await?;

        // 4b. 推送思考事件
        let _ = app.emit(
            "agent:thinking",
            json!({
                "sessionId": config.session_id,
                "iteration": iteration,
                "finishReason": response.finish_reason,
            }),
        );

        // 4c. 如果 LLM 返回 stop，保存并结束
        if response.finish_reason == "stop" {
            let content_str = response.content.clone();
            db::append_agent_message(
                &conn,
                &config.session_id,
                "assistant",
                content_str.as_deref(),
                None,
                None,
            )?;
            final_text = response.content.unwrap_or_default();
            break;
        }

        // 4d. 如果 LLM 返回 tool_calls，执行工具
        if response.finish_reason == "tool_calls" && !response.tool_calls.is_empty() {
            // 序列化 tool_calls 给 DB 存储
            let tc_json_for_db: Vec<serde_json::Value> = response
                .tool_calls
                .iter()
                .map(|tc| {
                    json!({
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.name,
                            "arguments": serde_json::to_string(&tc.arguments).unwrap_or_default(),
                        }
                    })
                })
                .collect();

            // 保存 assistant 消息（含 tool_calls）
            db::append_agent_message(
                &conn,
                &config.session_id,
                "assistant",
                response.content.as_deref(),
                None,
                Some(&serde_json::to_string(&tc_json_for_db).unwrap()),
            )?;

            // 更新 messages_json：追加 assistant 消息
            let mut assistant_msg = json!({
                "role": "assistant",
                "content": response.content,
            });
            assistant_msg
                .as_object_mut()
                .unwrap()
                .insert("tool_calls".into(), json!(tc_json_for_db));
            if let Some(arr) = messages_json.as_array_mut() {
                arr.push(assistant_msg);
            }

            // 逐个执行工具
            for tc in &response.tool_calls {
                let _ = app.emit(
                    "agent:tool_call",
                    json!({
                        "sessionId": config.session_id,
                        "toolName": tc.name,
                        "toolCallId": tc.id,
                    }),
                );

                let tool = tools.iter().find(|t| t.name() == tc.name);
                let result = match tool {
                    Some(executor) => {
                        let ctx = ToolContext {
                            http: http.clone(),
                            app: app.clone(),
                            project_path: project_path.to_path_buf(),
                            settings: settings.clone(),
                        };
                        // 工具执行超时 30s
                        match tokio::time::timeout(
                            std::time::Duration::from_secs(30),
                            tokio::task::spawn_blocking(move || executor.execute(&tc.arguments, &ctx)),
                        )
                        .await
                        {
                            Ok(Ok(Ok(r))) => Ok(r),
                            Ok(Ok(Err(e))) => Err(e),
                            Ok(Err(e)) => Err(format!("工具执行线程错误：{}", e)),
                            Err(_) => Err(format!("工具 {} 执行超时(30s)", tc.name)),
                        }
                    }
                    None => Err(format!("未知工具：{}", tc.name)),
                };

                let tool_result = result.unwrap_or_else(|e| format!("[错误] {}", e));

                let preview = &tool_result[..tool_result.len().min(200)];
                let _ = app.emit(
                    "agent:tool_result",
                    json!({
                        "sessionId": config.session_id,
                        "toolCallId": tc.id,
                        "toolName": tc.name,
                        "resultPreview": preview,
                    }),
                );

                // 保存 tool 消息
                db::append_agent_message(
                    &conn,
                    &config.session_id,
                    "tool",
                    Some(&tool_result),
                    Some(&tc.id),
                    None,
                )?;

                // 追加到 messages_json
                if let Some(arr) = messages_json.as_array_mut() {
                    arr.push(json!({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": tool_result,
                    }));
                }
            }

            // 继续循环
            continue;
        }

        // 4e. 其他情况
        let content_str = response.content.clone();
        db::append_agent_message(
            &conn,
            &config.session_id,
            "assistant",
            content_str.as_deref(),
            None,
            None,
        )?;
        final_text = response.content.unwrap_or_else(|| "[Agent] 未预期的结束条件".into());
        break;
    }

    Ok(final_text)
}
```

**验证**：`cargo check --manifest-path src-tauri/Cargo.toml` 编译通过（此时 agent_tools 不存在，下一步创建）。

---

## Step 8：新建 agent_tools.rs — 5 个工具

**文件**：`src-tauri/src/executor/agent_tools.rs`（新建）

```rust
use super::agent::{ToolContext, ToolExecutor};
use crate::db;
use crate::executor;
use crate::graph::CanvasGraph;
use crate::settings;
use serde_json::json;

/// 返回默认工具集
pub fn default_tools() -> Vec<Box<dyn ToolExecutor>> {
    vec![
        Box::new(RunSubgraphTool),
        Box::new(QueryProjectTool),
        Box::new(GenerateImageTool),
        Box::new(UpdateNodeDataTool),
        Box::new(LlmCompleteTool),
    ]
}

// ==================== 工具 1：执行工作流子图 ====================

struct RunSubgraphTool;

impl ToolExecutor for RunSubgraphTool {
    fn name(&self) -> &str {
        "run_subgraph"
    }
    fn description(&self) -> &str {
        "从指定节点开始执行工作流子图（含该节点及所有下游节点）。用于触发脚本解析、图片生成、视频拼接等操作。返回执行结果摘要，包含 run_id、节点状态和产出路径。"
    }
    fn parameters_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "fromNodeId": {
                    "type": "string",
                    "description": "起始节点 ID"
                },
                "force": {
                    "type": "boolean",
                    "description": "是否强制重新执行已成功的节点",
                    "default": false
                }
            },
            "required": ["fromNodeId"]
        })
    }
    fn execute(&self, args: &serde_json::Value, ctx: &ToolContext) -> Result<String, String> {
        let from_id = args
            .get("fromNodeId")
            .and_then(|v| v.as_str())
            .ok_or("缺少 fromNodeId 参数")?;
        let force = args.get("force").and_then(|v| v.as_bool()).unwrap_or(false);

        // 读取 canvasflow.json
        let graph_path = ctx.project_path.join("canvasflow.json");
        let graph_json: serde_json::Value = std::fs::read_to_string(&graph_path)
            .map_err(|e| format!("读取 canvasflow.json 失败：{}", e))
            .and_then(|s| serde_json::from_str(&s).map_err(|e| e.to_string()))?;
        let graph: CanvasGraph =
            serde_json::from_value(graph_json).map_err(|e| format!("解析图数据失败：{}", e))?;

        // 同步调用异步执行器
        let rt = tokio::runtime::Handle::current();
        let result = rt.block_on(executor::run_subgraph_with_patch(
            &ctx.http,
            &ctx.project_path,
            &graph,
            &ctx.settings,
            from_id,
            None,
            force,
        ))?;

        Ok(serde_json::to_string(&result).unwrap_or_default())
    }
}

// ==================== 工具 2：查询项目信息 ====================

struct QueryProjectTool;

impl ToolExecutor for QueryProjectTool {
    fn name(&self) -> &str {
        "query_project"
    }
    fn description(&self) -> &str {
        "查询当前项目的各类信息，包括工作流图结构、节点详情、素材库、历史运行记录。Agent 应在执行操作前先查询了解当前状态。"
    }
    fn parameters_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "queryType": {
                    "type": "string",
                    "enum": ["graph_structure", "node_detail", "assets", "recent_runs"],
                    "description": "查询类型"
                },
                "nodeId": {
                    "type": "string",
                    "description": "查询节点详情时的节点 ID"
                }
            },
            "required": ["queryType"]
        })
    }
    fn execute(&self, args: &serde_json::Value, ctx: &ToolContext) -> Result<String, String> {
        let query_type = args
            .get("queryType")
            .and_then(|v| v.as_str())
            .ok_or("缺少 queryType 参数")?;

        match query_type {
            "graph_structure" => {
                let graph_path = ctx.project_path.join("canvasflow.json");
                let content = std::fs::read_to_string(&graph_path)
                    .map_err(|e| format!("读取 canvasflow.json 失败：{}", e))?;
                // 只返回节点列表和边列表的摘要
                let graph: serde_json::Value = serde_json::from_str(&content)
                    .map_err(|e| format!("解析失败：{}", e))?;
                let nodes = graph.get("nodes").and_then(|v| v.as_array());
                let edges = graph.get("edges").and_then(|v| v.as_array());
                let summary = json!({
                    "nodeCount": nodes.map(|a| a.len()),
                    "edgeCount": edges.map(|a| a.len()),
                    "nodes": nodes.map(|a| a.iter().map(|n| json!({
                        "id": n.get("id").and_then(|v| v.as_str()),
                        "type": n.get("type").and_then(|v| v.as_str()),
                    })).collect::<Vec<_>>()),
                });
                Ok(serde_json::to_string_pretty(&summary).unwrap_or_default())
            }
            "node_detail" => {
                let node_id = args
                    .get("nodeId")
                    .and_then(|v| v.as_str())
                    .ok_or("node_detail 查询需要 nodeId 参数")?;
                let graph_path = ctx.project_path.join("canvasflow.json");
                let content = std::fs::read_to_string(&graph_path)
                    .map_err(|e| format!("读取 canvasflow.json 失败：{}", e))?;
                let graph: serde_json::Value = serde_json::from_str(&content)
                    .map_err(|e| format!("解析失败：{}", e))?;
                let node = graph
                    .get("nodes")
                    .and_then(|v| v.as_array())
                    .and_then(|a| a.iter().find(|n| n.get("id").and_then(|v| v.as_str()) == Some(node_id)));
                match node {
                    Some(n) => Ok(serde_json::to_string_pretty(n).unwrap_or_default()),
                    None => Err(format!("找不到节点：{}", node_id)),
                }
            }
            "assets" => {
                let conn = db::open_run_db(&ctx.project_path)?;
                let assets = db::list_assets(&conn, 50)?;
                Ok(serde_json::to_string_pretty(&assets).unwrap_or_default())
            }
            "recent_runs" => {
                let conn = db::open_run_db(&ctx.project_path)?;
                let runs = db::list_runs(&conn, 10)?;
                Ok(serde_json::to_string_pretty(&runs).unwrap_or_default())
            }
            _ => Err(format!("未知查询类型：{}", query_type)),
        }
    }
}

// ==================== 工具 3：生成图片 ====================

struct GenerateImageTool;

impl ToolExecutor for GenerateImageTool {
    fn name(&self) -> &str {
        "generate_image"
    }
    fn description(&self) -> &str {
        "根据提示词生成图片素材，保存到项目素材库。返回素材的相对路径和 asset_id。"
    }
    fn parameters_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": "图片生成提示词"
                },
                "modelId": {
                    "type": "string",
                    "description": "图片模型 ID（可选，不填使用默认）"
                },
                "referenceImagePaths": {
                    "type": "array",
                    "items": { "type": "string" },
                    "description": "参考图片相对路径（可选，最多4张）"
                }
            },
            "required": ["prompt"]
        })
    }
    fn execute(&self, args: &serde_json::Value, ctx: &ToolContext) -> Result<String, String> {
        let prompt = args
            .get("prompt")
            .and_then(|v| v.as_str())
            .ok_or("缺少 prompt 参数")?;
        let model_id = args.get("modelId").and_then(|v| v.as_str()).map(|s| s.to_string());
        let refs = args
            .get("referenceImagePaths")
            .and_then(|v| v.as_array())
            .map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect::<Vec<_>>())
            .unwrap_or_default();

        // 复用已有的 Tauri command 逻辑
        let rt = tokio::runtime::Handle::current();
        let result = rt.block_on(async {
            crate::commands::media_gen_cmd::generate_image_asset(
                ctx.app.clone(),
                tauri::State::from(&crate::AppState::new()),
                ctx.project_path.to_string_lossy().to_string(),
                prompt.to_string(),
                model_id,
                String::new(),
                None,
                if refs.is_empty() { None } else { Some(refs) },
            )
            .await
        });

        // 注：上面 AppState::new() 会创建新的 http client，生产环境应从 ctx 获取
        // 此处简化处理，实际需要重构 media_gen_cmd 使其接受 &reqwest::Client 参数
        match result {
            Ok(rel_path) => Ok(json!({ "relPath": rel_path }).to_string()),
            Err(e) => Err(e),
        }
    }
}

// ==================== 工具 4：更新节点数据 ====================

struct UpdateNodeDataTool;

impl ToolExecutor for UpdateNodeDataTool {
    fn name(&self) -> &str {
        "update_node_data"
    }
    fn description(&self) -> &str {
        "更新工作流中指定节点的数据（浅合并）。修改后会通知前端刷新画布。用于填写生成的分镜内容、修改提示词等。"
    }
    fn parameters_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "nodeId": {
                    "type": "string",
                    "description": "目标节点 ID"
                },
                "dataPatch": {
                    "type": "object",
                    "description": "要合并到 node.data 的字段（浅合并）"
                }
            },
            "required": ["nodeId", "dataPatch"]
        })
    }
    fn execute(&self, args: &serde_json::Value, ctx: &ToolContext) -> Result<String, String> {
        use tauri::Emitter;

        let node_id = args
            .get("nodeId")
            .and_then(|v| v.as_str())
            .ok_or("缺少 nodeId 参数")?;
        let patch = args
            .get("dataPatch")
            .ok_or("缺少 dataPatch 参数")?;

        let graph_path = ctx.project_path.join("canvasflow.json");
        let content = std::fs::read_to_string(&graph_path)
            .map_err(|e| format!("读取 canvasflow.json 失败：{}", e))?;
        let mut graph: serde_json::Value = serde_json::from_str(&content)
            .map_err(|e| format!("解析失败：{}", e))?;

        // 找到节点并浅合并 data
        let nodes = graph
            .get_mut("nodes")
            .and_then(|v| v.as_array_mut())
            .ok_or("图数据中无 nodes 数组")?;

        let mut found = false;
        for node in nodes.iter_mut() {
            if node.get("id").and_then(|v| v.as_str()) == Some(node_id) {
                if let Some(data) = node.get_mut("data") {
                    if let (Some(data_obj), Some(patch_obj)) =
                        (data.as_object_mut(), patch.as_object())
                    {
                        for (k, v) in patch_obj {
                            data_obj.insert(k.clone(), v.clone());
                        }
                        found = true;
                    }
                }
                break;
            }
        }

        if !found {
            return Err(format!("找不到节点：{}", node_id));
        }

        // 写回文件
        let updated = serde_json::to_string_pretty(&graph)
            .map_err(|e| format!("序列化失败：{}", e))?;
        std::fs::write(&graph_path, updated)
            .map_err(|e| format!("写入失败：{}", e))?;

        // 通知前端刷新
        let _ = ctx.app.emit(
            "graph:node_updated",
            json!({
                "nodeId": node_id,
                "patch": patch,
            }),
        );

        Ok(json!({ "ok": true, "nodeId": node_id }).to_string())
    }
}

// ==================== 工具 5：LLM 文本补全 ====================

struct LlmCompleteTool;

impl ToolExecutor for LlmCompleteTool {
    fn name(&self) -> &str {
        "llm_complete"
    }
    fn description(&self) -> &str {
        "调用 LLM 进行文本补全。用于 Agent 内部推理、文案创作、剧本改写等。不会触发工作流节点执行。"
    }
    fn parameters_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "systemPrompt": {
                    "type": "string",
                    "description": "系统提示词（可选）"
                },
                "userPrompt": {
                    "type": "string",
                    "description": "用户提示词"
                }
            },
            "required": ["userPrompt"]
        })
    }
    fn execute(&self, args: &serde_json::Value, ctx: &ToolContext) -> Result<String, String> {
        let user_prompt = args
            .get("userPrompt")
            .and_then(|v| v.as_str())
            .ok_or("缺少 userPrompt 参数")?;
        let system_prompt = args.get("systemPrompt").and_then(|v| v.as_str());

        let messages = match system_prompt {
            Some(sys) if !sys.trim().is_empty() => json!([
                { "role": "system", "content": sys },
                { "role": "user", "content": user_prompt },
            ]),
            _ => json!([{ "role": "user", "content": user_prompt }]),
        };

        let rt = tokio::runtime::Handle::current();
        rt.block_on(executor::openai_chat_completion(
            &ctx.http,
            &ctx.settings,
            messages,
            &json!({}),
        ))
    }
}
```

**验证**：`cargo check --manifest-path src-tauri/Cargo.toml` 编译通过。

---

## Step 9：新建 agent_cmd.rs — Tauri Commands

**文件**：`src-tauri/src/commands/agent_cmd.rs`（新建）

```rust
use crate::db;
use crate::executor::{self, AgentConfig};
use crate::settings;
use crate::AppState;
use std::path::PathBuf;

#[tauri::command]
pub async fn agent_create_session(
    project_path: String,
    title: Option<String>,
) -> Result<String, String> {
    let path = PathBuf::from(&project_path);
    let conn = db::open_run_db(&path)?;
    let id = uuid::Uuid::new_v4().to_string();
    db::create_session(&conn, &id, &project_path, title.as_deref())?;
    Ok(id)
}

#[tauri::command]
pub async fn agent_send_message(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    project_path: String,
    session_id: String,
    message: String,
) -> Result<String, String> {
    let s = settings::load_settings(&app)?;
    if !s.agent.agent_enabled {
        return Err("Agent 功能未启用，请在设置中开启".into());
    }

    // 插入系统提示词（如果这是会话的第一条消息）
    let path = PathBuf::from(&project_path);
    let conn = db::open_run_db(&path)?;
    let existing = db::get_agent_messages(&conn, &session_id)?;
    if existing.is_empty() {
        db::append_agent_message(
            &conn,
            &session_id,
            "system",
            Some("你是 CanvasFlow AI Studio 的创作助手。你运行在一个 AI 短剧创作平台中，用户通过工作流画布组织剧本、分镜、图片、音频、视频等创作节点。\n\n你的核心能力：\n1. 查询项目当前状态（工作流结构、节点数据、素材库）\n2. 执行工作流节点（触发脚本解析、图片生成等）\n3. 修改节点数据（填写生成的分镜内容等）\n4. 调用 LLM 进行文本创作和推理\n\n工作原则：\n- 在执行操作前，先用 query_project 了解当前状态\n- 每次只执行最小必要的操作步骤\n- 操作后向用户确认结果，不要一次执行大量操作\n- 如果用户的需求模糊，先追问澄清再行动\n- 出错时向用户解释原因并建议替代方案"),
            None,
            None,
        )?;
    }

    let config = AgentConfig {
        session_id,
        project_path,
        max_iterations: s.agent.max_iterations,
        agent_provider_id: s.agent.agent_provider_id,
        agent_model: s.agent.agent_model,
    };
    let tools = executor::default_tools();
    executor::run_agent_loop(&state.http, &app, &s, &config, &tools, &message).await
}

#[tauri::command]
pub fn agent_list_sessions(
    project_path: String,
) -> Result<Vec<db::SessionSummary>, String> {
    let path = PathBuf::from(project_path);
    let conn = db::open_run_db(&path)?;
    db::list_sessions(&conn, &path.to_string_lossy())
}

#[tauri::command]
pub fn agent_get_messages(
    project_path: String,
    session_id: String,
) -> Result<Vec<db::AgentMessageRow>, String> {
    let path = PathBuf::from(project_path);
    let conn = db::open_run_db(&path)?;
    db::get_agent_messages(&conn, &session_id)
}

#[tauri::command]
pub fn agent_delete_session(
    project_path: String,
    session_id: String,
) -> Result<(), String> {
    let path = PathBuf::from(project_path);
    let conn = db::open_run_db(&path)?;
    db::delete_session(&conn, &session_id)
}
```

**文件**：`src-tauri/src/commands/mod.rs`

追加：

```rust
pub mod agent_cmd;
```

**文件**：`src-tauri/src/lib.rs`

在 `.invoke_handler(tauri::generate_handler![` 列表末尾追加：

```rust
            commands::agent_cmd::agent_create_session,
            commands::agent_cmd::agent_send_message,
            commands::agent_cmd::agent_list_sessions,
            commands::agent_cmd::agent_get_messages,
            commands::agent_cmd::agent_delete_session,
```

**验证**：`cargo check --manifest-path src-tauri/Cargo.toml` 编译通过。

---

## Step 10：全量编译 + 测试验证

运行以下命令，全部通过才能进入前端步骤：

```bash
cargo test --manifest-path src-tauri/Cargo.toml
npm run typecheck
npm run test
```

---

## Step 11：前端 — 新建 agentStore

**文件**：`src/store/agentStore.ts`（新建）

```typescript
import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

export interface AgentMessage {
  id: number;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCallsJson?: string;
  createdAt: string;
  // UI 状态
  isStreaming?: boolean;
}

export interface ToolCallStatus {
  toolName: string;
  toolCallId: string;
  status: 'running' | 'done' | 'error';
  resultPreview?: string;
}

export interface SessionSummary {
  id: string;
  projectPath: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AgentState {
  sessionId: string | null;
  messages: AgentMessage[];
  isThinking: boolean;
  currentIteration: number;
  toolCallStatuses: ToolCallStatus[];
  sessions: SessionSummary[];

  // Actions
  createSession: (projectPath: string, title?: string) => Promise<string>;
  sendMessage: (projectPath: string, content: string) => Promise<void>;
  loadSession: (projectPath: string, sessionId: string) => Promise<void>;
  listSessions: (projectPath: string) => Promise<void>;
  deleteSession: (projectPath: string, sessionId: string) => Promise<void>;
  initListeners: () => Promise<UnlistenFn>;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  sessionId: null,
  messages: [],
  isThinking: false,
  currentIteration: 0,
  toolCallStatuses: [],
  sessions: [],

  createSession: async (projectPath, title) => {
    const id = await invoke<string>('agent_create_session', {
      projectPath,
      title: title ?? null,
    });
    set({ sessionId: id, messages: [], toolCallStatuses: [] });
    return id;
  },

  sendMessage: async (projectPath, content) => {
    let sid = get().sessionId;
    if (!sid) {
      sid = await get().createSession(projectPath);
    }

    // 立即追加用户消息到 UI
    const userMsg: AgentMessage = {
      id: Date.now(),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({
      messages: [...s.messages, userMsg],
      isThinking: true,
      toolCallStatuses: [],
    }));

    try {
      const reply = await invoke<string>('agent_send_message', {
        projectPath,
        sessionId: sid,
        message: content,
      });

      // 追加 assistant 最终回复
      const assistantMsg: AgentMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: reply,
        createdAt: new Date().toISOString(),
      };
      set((s) => ({
        messages: [...s.messages, assistantMsg],
        isThinking: false,
      }));
    } catch (e) {
      const errorMsg: AgentMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `[错误] ${e}`,
        createdAt: new Date().toISOString(),
      };
      set((s) => ({
        messages: [...s.messages, errorMsg],
        isThinking: false,
      }));
    }
  },

  loadSession: async (projectPath, sessionId) => {
    const rows = await invoke<AgentMessage[]>('agent_get_messages', {
      projectPath,
      sessionId,
    });
    set({
      sessionId,
      messages: rows.map((r) => ({
        ...r,
        content: r.content ?? '',
        toolCallId: r.toolCallId ?? undefined,
        toolCallsJson: r.toolCallsJson ?? undefined,
      })),
      toolCallStatuses: [],
    });
  },

  listSessions: async (projectPath) => {
    const sessions = await invoke<SessionSummary[]>('agent_list_sessions', {
      projectPath,
    });
    set({ sessions });
  },

  deleteSession: async (projectPath, sessionId) => {
    await invoke('agent_delete_session', { projectPath, sessionId });
    const { sessionId: current } = get();
    if (current === sessionId) {
      set({ sessionId: null, messages: [], toolCallStatuses: [] });
    }
    get().listSessions(projectPath);
  },

  initListeners: async () => {
    const unlisteners: UnlistenFn[] = [];

    unlisteners.push(
      await listen('agent:token', (event) => {
        const { sessionId, delta } = event.payload as {
          sessionId: string;
          delta: string;
        };
        const { sessionId: current } = get();
        if (sessionId !== current) return;

        set((s) => {
          const msgs = [...s.messages];
          const last = msgs[msgs.length - 1];
          if (last?.role === 'assistant' && last.isStreaming) {
            msgs[msgs.length - 1] = { ...last, content: last.content + delta };
          } else {
            msgs.push({
              id: Date.now(),
              role: 'assistant',
              content: delta,
              createdAt: new Date().toISOString(),
              isStreaming: true,
            });
          }
          return { messages: msgs };
        });
      })
    );

    unlisteners.push(
      await listen('agent:tool_call', (event) => {
        const { sessionId, toolName, toolCallId } = event.payload as {
          sessionId: string;
          toolName: string;
          toolCallId: string;
        };
        const { sessionId: current } = get();
        if (sessionId !== current) return;

        set((s) => ({
          toolCallStatuses: [
            ...s.toolCallStatuses,
            { toolName, toolCallId, status: 'running' },
          ],
        }));
      })
    );

    unlisteners.push(
      await listen('agent:tool_result', (event) => {
        const { sessionId, toolCallId, resultPreview } = event.payload as {
          sessionId: string;
          toolCallId: string;
          resultPreview: string;
        };
        const { sessionId: current } = get();
        if (sessionId !== current) return;

        set((s) => ({
          toolCallStatuses: s.toolCallStatuses.map((tc) =>
            tc.toolCallId === toolCallId
              ? { ...tc, status: 'done', resultPreview }
              : tc
          ),
        }));
      })
    );

    unlisteners.push(
      await listen('agent:thinking', (event) => {
        const { sessionId, iteration } = event.payload as {
          sessionId: string;
          iteration: number;
        };
        const { sessionId: current } = get();
        if (sessionId !== current) return;

        set({ isThinking: true, currentIteration: iteration });
      })
    );

    return () => unlisteners.forEach((fn) => fn());
  },
}));
```

**验证**：`npm run typecheck` 通过。

---

## Step 12：前端 — 新建 ChatPanel 组件

新建以下目录和文件：

```
src/features/agent/
├── ChatPanel.tsx
├── ChatMessageList.tsx
├── ChatInput.tsx
├── ToolCallBadge.tsx
└── index.ts
```

### `src/features/agent/ChatPanel.tsx`

```tsx
import { useEffect } from 'react';
import { useAgentStore } from '../../store/agentStore';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';

interface ChatPanelProps {
  projectPath: string;
  onClose: () => void;
}

export function ChatPanel({ projectPath, onClose }: ChatPanelProps) {
  const { initListeners, listSessions, sendMessage, isThinking } =
    useAgentStore();

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    initListeners().then((fn) => {
      unlisten = fn;
    });
    listSessions(projectPath);
    return () => {
      unlisten?.();
    };
  }, [projectPath]);

  return (
    <div
      style={{
        width: 380,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '0.5px solid var(--color-border-tertiary)',
        background: 'var(--color-background-primary)',
      }}
    >
      {/* 头部 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '0.5px solid var(--color-border-tertiary)',
        }}
      >
        <span style={{ fontWeight: 500, fontSize: 14 }}>AI 助手</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>
          x
        </button>
      </div>

      {/* 消息列表 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <ChatMessageList />
      </div>

      {/* 思考指示 */}
      {isThinking && (
        <div
          style={{
            padding: '8px 16px',
            fontSize: 12,
            color: 'var(--color-text-secondary)',
            background: 'var(--color-background-secondary)',
          }}
        >
          Agent 正在思考...
        </div>
      )}

      {/* 输入框 */}
      <ChatInput onSend={(content) => sendMessage(projectPath, content)} disabled={isThinking} />
    </div>
  );
}
```

### `src/features/agent/ChatMessageList.tsx`

```tsx
import { useAgentStore } from '../../store/agentStore';
import { ToolCallBadge } from './ToolCallBadge';

export function ChatMessageList() {
  const { messages, toolCallStatuses } = useAgentStore();

  return (
    <div style={{ padding: '12px 16px' }}>
      {messages
        .filter((m) => m.role !== 'system')
        .map((m, i) => (
          <div
            key={m.id ?? i}
            style={{
              marginBottom: 12,
              display: 'flex',
              justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '85%',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 13,
                lineHeight: 1.6,
                background:
                  m.role === 'user'
                    ? 'var(--color-background-info)'
                    : 'var(--color-background-secondary)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {m.content}
            </div>
          </div>
        ))}

      {/* 工具调用状态 */}
      {toolCallStatuses.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {toolCallStatuses.map((tc) => (
            <ToolCallBadge key={tc.toolCallId} {...tc} />
          ))}
        </div>
      )}
    </div>
  );
}
```

### `src/features/agent/ChatInput.tsx`

```tsx
import { useState } from 'react';

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('');

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      style={{
        padding: '12px 16px',
        borderTop: '0.5px solid var(--color-border-tertiary)',
      }}
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="输入指令，如"帮我生成分镜""
        disabled={disabled}
        rows={2}
        style={{
          width: '100%',
          resize: 'none',
          padding: '8px 12px',
          borderRadius: 8,
          border: '0.5px solid var(--color-border-tertiary)',
          fontSize: 13,
          lineHeight: 1.5,
          outline: 'none',
          fontFamily: 'inherit',
        }}
      />
      <button
        onClick={handleSend}
        disabled={disabled}
        style={{
          marginTop: 8,
          width: '100%',
          padding: '8px',
          borderRadius: 8,
          border: '0.5px solid var(--color-border-secondary)',
          background: disabled
            ? 'var(--color-background-tertiary)'
            : 'var(--color-background-primary)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        发送
      </button>
    </div>
  );
}
```

### `src/features/agent/ToolCallBadge.tsx`

```tsx
interface ToolCallBadgeProps {
  toolName: string;
  toolCallId: string;
  status: 'running' | 'done' | 'error';
  resultPreview?: string;
}

export function ToolCallBadge({ toolName, status, resultPreview }: ToolCallBadgeProps) {
  const statusLabel = status === 'running' ? '执行中...' : status === 'done' ? '完成' : '错误';
  const statusColor =
    status === 'running'
      ? 'var(--color-text-warning)'
      : status === 'done'
        ? 'var(--color-text-success)'
        : 'var(--color-text-danger)';

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 6,
        fontSize: 11,
        background: 'var(--color-background-secondary)',
        marginBottom: 4,
        marginRight: 4,
      }}
    >
      <span style={{ fontWeight: 500 }}>{toolName}</span>
      <span style={{ color: statusColor }}>{statusLabel}</span>
      {resultPreview && (
        <span style={{ color: 'var(--color-text-tertiary)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {resultPreview}
        </span>
      )}
    </div>
  );
}
```

### `src/features/agent/index.ts`

```typescript
export { ChatPanel } from './ChatPanel';
```

---

## Step 13：前端 — 画布入口按钮

在画布主布局组件中（通常是 `ProMode.tsx` 或 `App.tsx`），增加一个按钮和 ChatPanel 的条件渲染。

**具体位置**：找到画布布局的根 `<div>`，在其同级或右侧增加：

```tsx
import { ChatPanel } from '../features/agent';

// 在组件中增加 state
const [showAgent, setShowAgent] = useState(false);
const projectPath = /* 从 projectStore 获取当前项目路径 */;

// 在 JSX 中
{/* Agent 按钮 */}
<button
  onClick={() => setShowAgent(!showAgent)}
  style={{
    position: 'fixed',
    right: 16,
    bottom: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    border: '0.5px solid var(--color-border-secondary)',
    background: 'var(--color-background-primary)',
    cursor: 'pointer',
    fontSize: 18,
    zIndex: 100,
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  }}
>
  AI
</button>

{/* ChatPanel */}
{showAgent && projectPath && (
  <div style={{ position: 'fixed', right: 0, top: 0, height: '100vh', zIndex: 99 }}>
    <ChatPanel projectPath={projectPath} onClose={() => setShowAgent(false)} />
  </div>
)}
```

**验证**：`npm run typecheck` 通过。`npm run dev` 启动后，右下角出现 AI 按钮，点击打开 ChatPanel。

---

## Step 14：端到端验证

按以下场景手动测试：

### 场景 1：基础对话
1. 点击 AI 按钮 → ChatPanel 打开
2. 输入"你好" → Agent 返回问候
3. 关闭面板 → 重新打开 → 对话历史保持

### 场景 2：查询项目
1. 打开一个有节点的工作流项目
2. 输入"现在项目里有什么节点" → Agent 调用 `query_project` → 返回节点列表
3. 输入"第一个节点的详情" → Agent 调用 `query_project(node_detail)` → 返回节点数据

### 场景 3：执行工作流
1. 输入"帮我跑一下脚本节点" → Agent 调用 `query_project` 找到 scriptNode → 调用 `run_subgraph` → 返回执行结果

### 场景 4：降级测试
1. 在设置中关闭 `agentEnabled` → 发送消息 → 返回"Agent 功能未启用"
2. 不配 API Key → 发送消息 → Agent 返回错误提示而非崩溃

---

## 完成标志

以下全部通过即视为完成：

- [ ] Step 1-4：Rust 后端编译通过
- [ ] Step 5-6：DB + Settings 扩展无侵入
- [ ] Step 7-8：Agent Loop + 工具注册正常
- [ ] Step 9：5 个 Tauri command 注册成功
- [ ] Step 10：`cargo test` + `npm run typecheck` + `npm run test` 全通过
- [ ] Step 11-12：前端 agentStore + ChatPanel 编译通过
- [ ] Step 13：画布入口按钮可用
- [ ] Step 14：4 个端到端场景全部通过
