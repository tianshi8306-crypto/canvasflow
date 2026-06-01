use crate::command_common::resolve_ffmpeg_bin_auto;
use crate::executor;
use crate::graph::CanvasGraph;
use crate::settings;
use crate::AppState;
use std::path::PathBuf;

#[tauri::command]
pub async fn execute_graph(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    project_path: String,
    graph: serde_json::Value,
) -> Result<String, String> {
    let mut s = settings::load_settings(&app)?;
    if s.ffmpeg_path.as_ref().map(|x| x.trim()).unwrap_or("").is_empty() {
        s.ffmpeg_path = Some(resolve_ffmpeg_bin_auto(&app, &s));
    }
    let g: CanvasGraph = serde_json::from_value(graph).map_err(|e| e.to_string())?;
    let path = PathBuf::from(project_path);
    executor::run_graph(&state.http, &path, &g, &s).await
}

#[tauri::command]
pub async fn execute_graph_with_patch(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    project_path: String,
    graph: serde_json::Value,
) -> Result<executor::GraphRunResult, String> {
    let mut s = settings::load_settings(&app)?;
    if s.ffmpeg_path.as_ref().map(|x| x.trim()).unwrap_or("").is_empty() {
        s.ffmpeg_path = Some(resolve_ffmpeg_bin_auto(&app, &s));
    }
    let g: CanvasGraph = serde_json::from_value(graph).map_err(|e| e.to_string())?;
    let path = PathBuf::from(project_path);
    executor::run_graph_with_patch(&state.http, &path, &g, &s).await
}

#[tauri::command]
pub async fn execute_subgraph(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    project_path: String,
    graph: serde_json::Value,
    from_node_id: String,
    previous_run_id: Option<String>,
    force: Option<bool>,
) -> Result<String, String> {
    let mut s = settings::load_settings(&app)?;
    if s.ffmpeg_path.as_ref().map(|x| x.trim()).unwrap_or("").is_empty() {
        s.ffmpeg_path = Some(resolve_ffmpeg_bin_auto(&app, &s));
    }
    let g: CanvasGraph = serde_json::from_value(graph).map_err(|e| e.to_string())?;
    let path = PathBuf::from(project_path);
    executor::run_subgraph(
        &state.http,
        &path,
        &g,
        &s,
        &from_node_id,
        previous_run_id.as_deref(),
        force.unwrap_or(false),
    )
    .await
}

#[tauri::command]
pub async fn execute_subgraph_with_patch(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    project_path: String,
    graph: serde_json::Value,
    from_node_id: String,
    previous_run_id: Option<String>,
    force: Option<bool>,
) -> Result<executor::GraphRunResult, String> {
    let mut s = settings::load_settings(&app)?;
    if s.ffmpeg_path.as_ref().map(|x| x.trim()).unwrap_or("").is_empty() {
        s.ffmpeg_path = Some(resolve_ffmpeg_bin_auto(&app, &s));
    }
    let g: CanvasGraph = serde_json::from_value(graph).map_err(|e| e.to_string())?;
    let path = PathBuf::from(project_path);
    executor::run_subgraph_with_patch(
        &state.http,
        &path,
        &g,
        &s,
        &from_node_id,
        previous_run_id.as_deref(),
        force.unwrap_or(false),
    )
    .await
}

/// 单次对话补全（不写 runs.db），供侧栏分镜文案等 UI 调用。
#[tauri::command]
pub async fn llm_complete_text(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    system_prompt: Option<String>,
    user_prompt: String,
    provider_id: Option<String>,
    model: Option<String>,
) -> Result<String, String> {
    use serde_json::json;
    let s = settings::load_settings(&app)?;
    let messages = match system_prompt {
        Some(ref sys) if !sys.trim().is_empty() => json!([
            { "role": "system", "content": sys },
            { "role": "user", "content": user_prompt },
        ]),
        _ => json!([{ "role": "user", "content": user_prompt }]),
    };
    let mut extra = json!({});
    if let Some(pid) = provider_id.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        extra["providerId"] = json!(pid);
    }
    if let Some(m) = model.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        extra["model"] = json!(m);
    }
    executor::openai_chat_completion(&state.http, &s, messages, &extra).await
}
