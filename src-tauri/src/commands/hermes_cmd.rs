use crate::executor::hermes_agent;
use crate::graph::CanvasGraph;
use crate::settings;
use crate::AppState;
use serde_json::json;

fn parse_graph(graph_json: serde_json::Value) -> Result<CanvasGraph, String> {
    serde_json::from_value(graph_json).map_err(|e| format!("画布 JSON 解析失败：{}", e))
}

pub fn build_extra(provider_id: Option<String>, model: Option<String>) -> serde_json::Value {
    let mut extra = json!({});
    if let Some(pid) = provider_id.and_then(|s| {
        let t = s.trim().to_string();
        if t.is_empty() {
            None
        } else {
            Some(t)
        }
    }) {
        extra["providerId"] = json!(pid);
    }
    if let Some(m) = model.and_then(|s| {
        let t = s.trim().to_string();
        if t.is_empty() {
            None
        } else {
            Some(t)
        }
    }) {
        extra["model"] = json!(m);
    }
    extra
}

#[tauri::command]
pub async fn hermes_chat_stream(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    request_id: String,
    graph_json: serde_json::Value,
    focus_node_id: Option<String>,
    user_message: String,
    situation_summary: Option<String>,
    chat_history: Vec<serde_json::Value>,
    provider_id: Option<String>,
    model: Option<String>,
    advisor_mode: Option<bool>,
    reply_style: Option<String>,
    message_mode: Option<String>,
) -> Result<String, String> {
    let s = settings::load_settings(&app)?;
    let graph = parse_graph(graph_json)?;
    let mut extra = build_extra(provider_id, model);
    if advisor_mode.unwrap_or(false) {
        extra["advisorMode"] = json!(true);
    }
    if let Some(rs) = reply_style.and_then(|s| {
        let t = s.trim().to_string();
        if t.is_empty() {
            None
        } else {
            Some(t)
        }
    }) {
        extra["replyStyle"] = json!(rs);
    }
    if let Some(mm) = message_mode.and_then(|s| {
        let t = s.trim().to_string();
        if t.is_empty() {
            None
        } else {
            Some(t)
        }
    }) {
        extra["messageMode"] = json!(mm);
    }
    let focus = focus_node_id
        .as_deref()
        .map(str::trim)
        .filter(|x| !x.is_empty());
    let situation = situation_summary
        .as_deref()
        .map(str::trim)
        .filter(|x| !x.is_empty())
        .unwrap_or("");
    hermes_agent::chat_stream(
        &app,
        &state.http,
        &s,
        &graph,
        focus,
        user_message.trim(),
        situation,
        &chat_history,
        &extra,
        request_id.trim(),
    )
    .await
}

#[tauri::command]
pub async fn hermes_enhance(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    graph_json: serde_json::Value,
    node_id: String,
    current_prompt: String,
    provider_id: Option<String>,
    model: Option<String>,
) -> Result<String, String> {
    let s = settings::load_settings(&app)?;
    let graph = parse_graph(graph_json)?;
    let extra = build_extra(provider_id, model);
    hermes_agent::enhance_prompt(
        &state.http,
        &s,
        &graph,
        node_id.trim(),
        current_prompt.trim(),
        &extra,
    )
    .await
}

#[tauri::command]
pub async fn hermes_plan(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    graph_json: serde_json::Value,
    user_message: String,
    situation_summary: String,
    provider_id: Option<String>,
    model: Option<String>,
    reply_style: Option<String>,
    message_mode: Option<String>,
) -> Result<String, String> {
    let s = settings::load_settings(&app)?;
    let graph = parse_graph(graph_json)?;
    let mut extra = build_extra(provider_id, model);
    if let Some(rs) = reply_style.and_then(|s| {
        let t = s.trim().to_string();
        if t.is_empty() {
            None
        } else {
            Some(t)
        }
    }) {
        extra["replyStyle"] = json!(rs);
    }
    if let Some(mm) = message_mode.and_then(|s| {
        let t = s.trim().to_string();
        if t.is_empty() {
            None
        } else {
            Some(t)
        }
    }) {
        extra["messageMode"] = json!(mm);
    }
    hermes_agent::plan_director(
        &state.http,
        &s,
        &graph,
        user_message.trim(),
        situation_summary.trim(),
        &extra,
    )
    .await
}

#[tauri::command]
pub async fn hermes_orb_suggest(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    situation_summary: String,
    rule_draft_json: String,
    provider_id: Option<String>,
    model: Option<String>,
) -> Result<String, String> {
    let s = settings::load_settings(&app)?;
    let extra = build_extra(provider_id, model);
    hermes_agent::suggest_orb(
        &state.http,
        &s,
        situation_summary.trim(),
        rule_draft_json.trim(),
        &extra,
    )
    .await
}
