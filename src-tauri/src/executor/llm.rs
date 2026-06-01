use crate::db;
use crate::graph::{CanvasGraph, FlowNode};
use crate::settings::{AppSettings, ProviderConfig};
use crate::vault;
use rusqlite::Connection;
use serde_json::json;
use std::collections::HashMap;
use tauri::Emitter;

use super::graph_flow::incoming_texts_ordered;

pub(crate) fn build_llm_request_parts(
    settings: &AppSettings,
    messages: serde_json::Value,
    extra_params: &serde_json::Value,
) -> Result<(ProviderConfig, String, String, serde_json::Value), String> {
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
                if k != "model" && k != "messages" && k != "providerId" && k != "stream" {
                    obj.insert(k, v);
                }
            }
        }
    }

    let url = format!(
        "{}/chat/completions",
        provider.base_url.trim_end_matches('/')
    );
    Ok((provider, api_key, url, body))
}

/// SSE 流式 chat/completions；通过 Tauri 事件推送 token。
pub async fn openai_chat_completion_stream(
    app: &tauri::AppHandle,
    http: &reqwest::Client,
    settings: &AppSettings,
    messages: serde_json::Value,
    extra_params: &serde_json::Value,
    request_id: &str,
) -> Result<String, String> {
    use futures_util::StreamExt;

    let (_provider, api_key, url, mut body) =
        build_llm_request_parts(settings, messages, extra_params)?;
    if let Some(obj) = body.as_object_mut() {
        obj.insert("stream".into(), json!(true));
    }

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
        let err = format!("LLM API 失败: {}", text);
        let _ = app.emit(
            "hermes-chat-error",
            json!({ "requestId": request_id, "error": err }),
        );
        return Err(err);
    }

    let content_type = resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if !content_type.contains("text/event-stream") {
        let text = resp.text().await.map_err(|e| e.to_string())?;
        let parsed: serde_json::Value =
            serde_json::from_str(&text).unwrap_or_else(|_| json!({ "raw": text }));
        let content = parsed
            .pointer("/choices/0/message/content")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let _ = app.emit(
            "hermes-chat-done",
            json!({ "requestId": request_id, "fullContent": content }),
        );
        return Ok(content);
    }

    let mut full_content = String::new();
    let mut stream = resp.bytes_stream();
    let mut byte_buffer: Vec<u8> = Vec::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        byte_buffer.extend_from_slice(&chunk);

        while let Some(pos) = byte_buffer.windows(2).position(|w| w == b"\n\n") {
            let line_bytes = byte_buffer[..pos].to_vec();
            byte_buffer = byte_buffer[pos + 2..].to_vec();
            let line = String::from_utf8_lossy(&line_bytes);

            for sub in line.lines() {
                let sub = sub.trim();
                if !sub.starts_with("data: ") {
                    continue;
                }
                let data = &sub[6..];
                if data == "[DONE]" {
                    let _ = app.emit(
                        "hermes-chat-done",
                        json!({ "requestId": request_id, "fullContent": full_content }),
                    );
                    return Ok(full_content);
                }
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                    if let Some(delta) = parsed.pointer("/choices/0/delta/content") {
                        if let Some(text) = delta.as_str() {
                            if !text.is_empty() {
                                full_content.push_str(text);
                                let _ = app.emit(
                                    "hermes-chat-chunk",
                                    json!({ "requestId": request_id, "token": text }),
                                );
                            }
                        }
                    }
                }
            }
        }
    }

    let _ = app.emit(
        "hermes-chat-done",
        json!({ "requestId": request_id, "fullContent": full_content }),
    );
    Ok(full_content)
}

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
