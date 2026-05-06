use crate::commands::types::{
    GenericApiPollRequest, GenericApiPollResponse, GenericApiSubmitRequest, GenericApiSubmitResponse,
};
use crate::AppState;

#[tauri::command]
pub async fn generic_async_api_submit(
    state: tauri::State<'_, AppState>,
    req: GenericApiSubmitRequest,
) -> Result<GenericApiSubmitResponse, String> {
    if req.url.trim().is_empty() {
        return Err("url 不能为空".into());
    }
    if req.task_id_pointer.trim().is_empty() {
        return Err("taskIdPointer 不能为空".into());
    }
    let method = req.method.unwrap_or_else(|| "POST".into()).to_uppercase();
    let mut builder = match method.as_str() {
        "GET" => state.http.get(req.url.trim()),
        _ => state.http.post(req.url.trim()),
    };
    for (k, v) in &req.headers {
        if !k.trim().is_empty() {
            builder = builder.header(k.trim(), v);
        }
    }
    if method != "GET" {
        builder = builder.json(&req.body);
    }
    let resp = builder.send().await.map_err(|e| format!("提交失败：{}", e))?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| e.to_string())?;
    let parsed: serde_json::Value =
        serde_json::from_str(&text).unwrap_or_else(|_| serde_json::json!({ "raw": text }));
    if !status.is_success() {
        return Err(format!(
            "提交失败({})：{}",
            status.as_u16(),
            serde_json::to_string(&parsed).unwrap_or_default()
        ));
    }
    let task_id = parsed
        .pointer(req.task_id_pointer.trim())
        .and_then(|v| v.as_str())
        .ok_or_else(|| format!("未在响应中找到 task_id，路径: {}", req.task_id_pointer))?
        .to_string();
    Ok(GenericApiSubmitResponse { task_id, raw: parsed })
}

#[tauri::command]
pub async fn generic_async_api_poll(
    state: tauri::State<'_, AppState>,
    req: GenericApiPollRequest,
) -> Result<GenericApiPollResponse, String> {
    if req.url.trim().is_empty() {
        return Err("url 不能为空".into());
    }
    if req.status_pointer.trim().is_empty() {
        return Err("statusPointer 不能为空".into());
    }
    let method = req.method.unwrap_or_else(|| "POST".into()).to_uppercase();
    let mut builder = match method.as_str() {
        "GET" => state.http.get(req.url.trim()),
        _ => state.http.post(req.url.trim()),
    };
    for (k, v) in &req.headers {
        if !k.trim().is_empty() {
            builder = builder.header(k.trim(), v);
        }
    }
    if method != "GET" {
        builder = builder.json(&req.body);
    }
    let resp = builder.send().await.map_err(|e| format!("查询失败：{}", e))?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| e.to_string())?;
    let parsed: serde_json::Value =
        serde_json::from_str(&text).unwrap_or_else(|_| serde_json::json!({ "raw": text }));
    if !status.is_success() {
        return Err(format!(
            "查询失败({})：{}",
            status.as_u16(),
            serde_json::to_string(&parsed).unwrap_or_default()
        ));
    }

    let st = parsed
        .pointer(req.status_pointer.trim())
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let done = if let Some(v) = req.done_value {
        st == v
    } else {
        matches!(st.as_str(), "done" | "succeeded" | "success" | "failed" | "cancelled")
    };
    let result_url = req
        .result_url_pointer
        .as_deref()
        .and_then(|p| parsed.pointer(p))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let error = req
        .error_pointer
        .as_deref()
        .and_then(|p| parsed.pointer(p))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    Ok(GenericApiPollResponse {
        status: st,
        done,
        result_url,
        error,
        raw: parsed,
    })
}
