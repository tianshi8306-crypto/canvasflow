use crate::db;
use crate::graph::{CanvasGraph, FlowNode};
use crate::settings::{AppSettings, ProviderConfig};
use crate::vault;
use rusqlite::Connection;
use serde_json::json;
use std::collections::HashMap;

use super::graph_flow::incoming_texts_ordered;

/// OpenAI 兼容 `POST /chat/completions`，不含运行日志（供独立命令如分镜文案生成复用）。
pub async fn openai_chat_completion(
    http: &reqwest::Client,
    settings: &AppSettings,
    messages: serde_json::Value,
    extra_params: &serde_json::Value,
) -> Result<String, String> {
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
    if let Some(obj) = body.as_object_mut() {
        if let serde_json::Value::Object(p) = extra_params.clone() {
            for (k, v) in p {
                if k != "model" && k != "messages" && k != "providerId" {
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

    let content = parsed
        .pointer("/choices/0/message/content")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    Ok(content)
}

fn pick_provider(settings: &AppSettings) -> Result<ProviderConfig, String> {
    let mut list: Vec<ProviderConfig> = settings
        .providers
        .iter()
        .filter(|p| p.enabled)
        .cloned()
        .collect();
    list.sort_by_key(|p| p.priority);
    list
        .into_iter()
        .next()
        .ok_or_else(|| "没有可用的 Provider，请在设置中启用至少一个".into())
}

pub(crate) async fn run_llm_node(
    http: &reqwest::Client,
    graph: &CanvasGraph,
    node: &FlowNode,
    settings: &AppSettings,
    outputs: &HashMap<String, String>,
    conn: &mut Connection,
    run_id: &str,
) -> Result<String, String> {
    let provider = pick_provider(settings)?;

    let prompt = node
        .data
        .get("prompt")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let upstream = incoming_texts_ordered(graph, &node.id, outputs);
    let merged = if upstream.is_empty() {
        prompt.clone()
    } else {
        format!("{}\n\n—— 上游上下文 ——\n{}", prompt, upstream.join("\n\n"))
    };

    let params = node.data.get("params").cloned().unwrap_or(json!({}));
    let messages = json!([{ "role": "user", "content": merged }]);

    let url = format!(
        "{}/chat/completions",
        provider.base_url.trim_end_matches('/')
    );
    let sanitized_log = json!({
        "url": url,
        "model": provider.model,
        "bodyPreview": {
            "messages": messages,
        }
    });
    db::log_event(conn, run_id, Some(&node.id), "llm_request", &sanitized_log)?;

    let content = match openai_chat_completion(http, settings, messages, &params).await {
        Ok(c) => {
            let response_log = json!({ "ok": true, "contentLen": c.len() });
            db::log_event(conn, run_id, Some(&node.id), "llm_response", &response_log)?;
            c
        }
        Err(e) => {
            let response_log = json!({ "ok": false, "error": e });
            db::log_event(conn, run_id, Some(&node.id), "llm_response", &response_log)?;
            return Err(e);
        }
    };

    Ok(content)
}
