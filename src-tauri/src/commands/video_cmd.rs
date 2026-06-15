//! 视频生成供应商适配（当前默认 Doubao Seedance 2.0）。
//!
//! 核心链路：
//! 1. video_gen_start  -> 提交任务到供应商，返回 jobId
//! 2. video_gen_get_job -> 轮询供应商接口，状态 succeeded 时下载视频落盘

use crate::command_common::{normalize_openai_api_base, resolve_ffmpeg_bin};
use crate::commands::types::{
    DreaminaVideoRecoverRequest, PersistedVideoJobEntry, VideoGenStartResponse,
    VideoGenerationStartRequest, VideoJobPollHint, VideoJobSnapshot,
};
use crate::project_asset_store::{self, AssetWriteContext};
use crate::dreamina_cli::DreaminaCliState;
use crate::dreamina_gen;
use crate::settings;
use crate::vault::get_api_key;
use crate::AppState;
use crate::VideoMockJob;
use serde_json::json;
use std::path::{Path, PathBuf};
use std::process::Command;

/// Doubao Seedance API 基址
const DEFAULT_SEEDANCE_API_BASE: &str = "https://ark.cn-beijing.volces.com/api/v3";

fn video_jobs_dir(project_path: &str) -> PathBuf {
    PathBuf::from(project_path)
        .join(".canvasflow")
        .join("video-jobs")
}

fn sanitize_job_id_for_filename(job_id: &str) -> String {
    job_id
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

fn persist_video_job(project_path: &str, job_id: &str, job: &VideoMockJob) -> Result<(), String> {
    let dir = video_jobs_dir(project_path);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(format!("{}.json", sanitize_job_id_for_filename(job_id)));
    let raw = serde_json::to_string_pretty(job).map_err(|e| e.to_string())?;
    std::fs::write(path, raw).map_err(|e| e.to_string())?;
    Ok(())
}

fn load_persisted_video_job(project_path: &str, job_id: &str) -> Result<Option<VideoMockJob>, String> {
    let path = video_jobs_dir(project_path).join(format!(
        "{}.json",
        sanitize_job_id_for_filename(job_id)
    ));
    if !path.is_file() {
        return Ok(None);
    }
    let raw = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let job: VideoMockJob = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    Ok(Some(job))
}

fn succeeded_snapshot_from_persisted_job(id: &str, job: &VideoMockJob) -> Option<VideoJobSnapshot> {
    let rel = job
        .result_rel_path
        .as_ref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())?;
    Some(VideoJobSnapshot {
        id: id.to_string(),
        status: "succeeded".into(),
        progress: Some(1.0),
        error: None,
        model_id: job.model_id.clone(),
        result_rel_path: Some(rel.to_string()),
    })
}

fn restore_video_job_to_memory(state: &AppState, id: &str, job: &VideoMockJob) {
    if let Ok(mut map) = state.video_jobs.lock() {
        map.insert(id.to_string(), job.clone());
    }
}

fn job_not_found_snapshot(id: &str, model_id: &str) -> VideoJobSnapshot {
    VideoJobSnapshot {
        id: id.to_string(),
        status: "failed".into(),
        progress: None,
        error: Some("任务不存在（可能已过期）".into()),
        model_id: model_id.to_string(),
        result_rel_path: None,
    }
}

/// 内存任务表丢失时（热重载/重启），凭工程持久化记录 + 轮询上下文直接查供应商/即梦 CLI。
async fn poll_orphaned_video_job(
    app: &tauri::AppHandle,
    state: &AppState,
    id: &str,
    hint: &VideoJobPollHint,
    disk_job: Option<VideoMockJob>,
) -> Result<VideoJobSnapshot, String> {
    let project_path = hint.project_path.trim();
    let node_id = hint.node_id.trim();
    if project_path.is_empty() || node_id.is_empty() {
        return Err("缺少工程或节点上下文".into());
    }

    let model_id = disk_job
        .as_ref()
        .map(|j| j.model_id.clone())
        .unwrap_or_else(|| hint.model_id.trim().to_string());
    if model_id.is_empty() {
        return Err("缺少 modelId".into());
    }

    let workflow = disk_job
        .as_ref()
        .and_then(|j| j.dreamina_workflow.clone())
        .or_else(|| hint.workflow.clone())
        .unwrap_or_else(|| "text_to_video".into());
    let is_dreamina = disk_job
        .as_ref()
        .map(|j| j.is_dreamina)
        .unwrap_or_else(|| dreamina_gen::is_dreamina_model(&model_id));
    let poll_count = disk_job.as_ref().map(|j| j.polls.saturating_add(1)).unwrap_or(1);

    eprintln!(
        "[video_cmd] 恢复孤儿任务 poll: id={id} dreamina={is_dreamina} project={project_path}"
    );

    if let Some(ref d) = disk_job {
        if let Some(snap) = succeeded_snapshot_from_persisted_job(id, d) {
            eprintln!(
                "[video_cmd] 孤儿任务已从磁盘记录取回成片: id={id} rel={:?}",
                snap.result_rel_path
            );
            restore_video_job_to_memory(state, id, d);
            return Ok(snap);
        }
    }

    let snap = if is_dreamina {
        dreamina_gen::poll_video_via_cli(
            &state.http,
            id,
            project_path,
            &model_id,
            &workflow,
            Some(node_id),
            poll_count,
        )
        .await?
    } else if id.starts_with("mock_") {
        return Err("mock 任务无法在无内存表时恢复".into());
    } else {
        let mut http_snap = poll_video_job_http(
            &state.http,
            id,
            project_path,
            &model_id,
            app,
            Some(node_id),
            Some(workflow.as_str()),
        )
        .await?;
        if http_snap.status == "queued" && poll_count >= 2 {
            http_snap.status = "running".into();
        }
        http_snap
    };

    let mut job_record = disk_job.unwrap_or(VideoMockJob {
        job_id: id.to_string(),
        project_path: project_path.to_string(),
        node_id: node_id.to_string(),
        model_id: model_id.clone(),
        polls: poll_count,
        result_rel_path: None,
        cancelled: false,
        is_dreamina,
        dreamina_workflow: Some(workflow),
    });
    if job_record.job_id.trim().is_empty() {
        job_record.job_id = id.to_string();
    }
    job_record.polls = poll_count;
    if snap.status == "succeeded" {
        job_record.result_rel_path = snap.result_rel_path.clone();
    }

    {
        let mut map = state
            .video_jobs
            .lock()
            .map_err(|_| "video_jobs 锁异常".to_string())?;
        map.insert(id.to_string(), job_record.clone());
    }
    let _ = persist_video_job(project_path, id, &job_record);

    Ok(snap)
}

const DOUBAO_SEEDANCE_CANONICAL_ID: &str = "doubao_seedance_2_0";
const DOUBAO_SEEDANCE_API_MODEL: &str = "doubao-seedance-2-0-260128";

fn is_doubao_seedance_preset(cfg: &settings::ImageModelConfig) -> bool {
    let model = cfg.model.trim();
    cfg.id == "preset-video-doubao-seedance"
        || model == DOUBAO_SEEDANCE_API_MODEL
        || model == DOUBAO_SEEDANCE_CANONICAL_ID
}

fn canonical_video_model_id(cfg: &settings::ImageModelConfig) -> &str {
    if is_doubao_seedance_preset(cfg) {
        return DOUBAO_SEEDANCE_CANONICAL_ID;
    }
    let model = cfg.model.trim();
    if model.is_empty() {
        cfg.id.as_str()
    } else {
        model
    }
}

fn video_model_config_matches(cfg: &settings::ImageModelConfig, model_id: &str) -> bool {
    if !cfg.enabled {
        return false;
    }
    let mid = model_id.trim();
    if mid.is_empty() {
        return false;
    }
    let model = cfg.model.trim();
    model == mid || cfg.id == mid || canonical_video_model_id(cfg) == mid
}

fn seedance_api_model_id(cfg: &settings::ImageModelConfig) -> String {
    let model = cfg.model.trim();
    if model.is_empty() {
        return String::new();
    }
    if model == DOUBAO_SEEDANCE_CANONICAL_ID {
        return DOUBAO_SEEDANCE_API_MODEL.to_string();
    }
    model.to_string()
}

/// 从 settings 中解析视频模型配置（多个匹配项时优先使用已保存 API Key 的项）
fn resolve_video_model_config(
    app: &tauri::AppHandle,
    model_id: &str,
) -> Result<(String, String, String), String> {
    let app_settings = settings::load_settings(app)?;
    let candidates: Vec<&settings::ImageModelConfig> = app_settings
        .video_models
        .iter()
        .filter(|m| video_model_config_matches(m, model_id))
        .collect();

    if candidates.is_empty() {
        return Err(format!(
            "视频模型不存在或已禁用：{}（请确认已在 设置→视频模型 启用，且模型标识为火山接入点 ID）",
            model_id
        ));
    }

    let mut missing_key_label: Option<String> = None;
    for cfg in candidates {
        let api_model = seedance_api_model_id(cfg);
        if api_model.trim().is_empty() {
            return Err(format!("视频模型「{}」未填写 API 接入点 model", cfg.label));
        }

        let key_id = format!("video-model:{}", cfg.id);
        let api_key = match get_api_key(&key_id)? {
            Some(k) => k,
            None => {
                missing_key_label = Some(cfg.label.clone());
                continue;
            }
        };

        let base_url = if cfg.api_base_url.trim().is_empty() {
            DEFAULT_SEEDANCE_API_BASE.to_string()
        } else {
            cfg.api_base_url.trim().to_string()
        };

        return Ok((base_url, api_key, api_model));
    }

    Err(format!(
        "未配置视频模型 API Key：{}",
        missing_key_label.unwrap_or_else(|| model_id.to_string())
    ))
}

/// 调用 Seedance 提交视频生成任务
/// API: POST https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks
async fn submit_video_job_http(
    app: &tauri::AppHandle,
    http: &reqwest::Client,
    req: &VideoGenerationStartRequest,
) -> Result<String, String> {
    let (base_url, api_key, api_model) = resolve_video_model_config(app, &req.payload.model_id)?;

    // 构建 content[] 数组
    let mut content: Vec<serde_json::Value> = vec![];

    // 添加文本 prompt
    if !req.payload.prompt.is_empty() {
        content.push(json!({
            "type": "text",
            "text": req.payload.prompt
        }));
    }

    // 添加参考图片（≤9张，支持 first_frame / reference_image / last_frame）
    // API 使用公网 URL，role 支持: first_frame / reference_image / last_frame
    // role 规则因 workflow 而异：
    //   - first_last_frame: idx=0→first_frame, idx=1→last_frame, idx=2+→reference_image
    //   - image_to_video (首帧模式): first_frame（单张图）
    //   - image_reference / multimodal_reference: 全部 reference_image
    //   - text_to_video: 无图片
    if let Some(ref paths) = req.payload.reference_image_paths {
        for (idx, path) in paths.iter().take(9).enumerate() {
            let path_str = path.to_string();
            let role = match req.payload.workflow.as_str() {
                "first_last_frame" => {
                    if idx == 0 {
                        "first_frame"
                    } else if idx == 1 {
                        "last_frame"
                    } else {
                        "reference_image"
                    }
                }
                // 图生视频-首帧（单张图）：role 为 first_frame
                "image_to_video" => "first_frame",
                // 图片参考/全能参考：全部作为参考图
                "image_reference" | "multimodal_reference" => "reference_image",
                // 默认：首帧 + 参考图
                _ => {
                    if idx == 0 { "first_frame" } else { "reference_image" }
                }
            };
            content.push(json!({
                "type": "image_url",
                "image_url": { "url": path_str },
                "role": role
            }));
        }
    }

    // 添加参考视频（≤3个），role 支持: reference_video
    if let Some(ref paths) = req.payload.reference_video_paths {
        for path in paths.iter().take(3) {
            let path_str = path.to_string();
            content.push(json!({
                "type": "video_url",
                "video_url": { "url": path_str },
                "role": "reference_video"
            }));
        }
    }

    // 添加参考音频（≤3个）
    if let Some(ref paths) = req.payload.reference_audio_paths {
        for path in paths.iter().take(3) {
            let path_str = path.to_string();
            content.push(json!({
                "type": "audio_url",
                "audio_url": { "url": path_str }
            }));
        }
    }

    // 从 output 配置读取参数，默认值覆盖
    let mut duration = 5i64;
    let mut resolution = "720p".to_string();
    let mut ratio = "16:9".to_string();
    let mut generate_audio = true;
    let mut watermark = false;

    if let Some(output) = req.payload.output.as_object() {
        if let Some(v) = output.get("durationSec").and_then(|v| v.as_i64()) {
            duration = v;
        }
        if let Some(v) = output.get("resolution").and_then(|v| v.as_str()) {
            resolution = v.to_lowercase();
        }
        if let Some(v) = output.get("aspectRatio").and_then(|v| v.as_str()) {
            ratio = v.to_string();
        }
        if let Some(v) = output.get("generateAudio").and_then(|v| v.as_bool()) {
            generate_audio = v;
        }
        if let Some(v) = output.get("watermark").and_then(|v| v.as_bool()) {
            watermark = v;
        }
    }

    // 这些字段放到请求体顶层，不是 parameters 里
    let body = json!({
        "model": api_model,
        "content": content,
        "duration": duration,
        "resolution": resolution,
        "ratio": ratio,
        "generate_audio": generate_audio,
        "watermark": watermark
    });

    let body_str = serde_json::to_string(&body).unwrap_or_else(|_| "?".into());
    eprintln!("[submit_video_job_http] 请求体:\n{}", body_str);

    let url = format!("{}/contents/generations/tasks", base_url.trim_end_matches('/'));
    eprintln!("[submit_video_job_http] 发送请求到: {}", url);
    let resp = http
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("视频生成请求失败：{}", e))?;

    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("读取响应失败：{}", e))?;
    eprintln!("[submit_video_job_http] 响应状态: {}, 响应体: {}", status.as_u16(), text);

    if !status.is_success() {
        return Err(format!("视频生成失败({}): {}", status.as_u16(), text));
    }

    let parsed: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("响应 JSON 解析失败：{}", e))?;

    // 任务 ID 在 id 或 data.id 字段
    let job_id = parsed
        .pointer("/data/id")
        .and_then(|v| v.as_str())
        .or_else(|| parsed.pointer("/id").and_then(|v| v.as_str()))
        .ok_or_else(|| format!("响应中未找到 job id：{}", text))?
        .to_string();

    Ok(job_id)
}

/// 将火山方舟任务 status 映射为前端 Job 状态
pub(crate) fn map_seedance_task_status(api_status: &str) -> &'static str {
    match api_status {
        "pending" | "queued" => "queued",
        "processing" | "running" => "running",
        "succeeded" | "success" | "completed" => "succeeded",
        "failed" | "error" | "cancelled" => "failed",
        _ => "running",
    }
}

/// 从任务查询 JSON 解析视频下载 URL（兼容多版字段）
pub(crate) fn parse_video_url_from_task_json(parsed: &serde_json::Value) -> Option<String> {
    const PATHS: &[&str] = &[
        "/content/video_url",
        "/content/url",
        "/output/video_url",
        "/output/url",
        "/data/content/video_url",
        "/data/output/video_url",
        "/result/video_url",
        "/video_url",
    ];
    for path in PATHS {
        if let Some(url) = parsed.pointer(path).and_then(|v| v.as_str()) {
            let trimmed = url.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    None
}

/// 轮询视频任务状态
/// API: GET https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/{id}
async fn poll_video_job_http(
    http: &reqwest::Client,
    job_id: &str,
    project_path: &str,
    model_id: &str,
    app: &tauri::AppHandle,
    node_id: Option<&str>,
    workflow: Option<&str>,
) -> Result<VideoJobSnapshot, String> {
    let (base_url, api_key, _api_model) = resolve_video_model_config(app, model_id)?;
    let url = format!("{}/contents/generations/tasks/{}", base_url.trim_end_matches('/'), job_id);

    let resp = http
        .get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| format!("查询任务状态失败：{}", e))?;

    let status_code = resp.status();
    let text = resp.text().await.map_err(|e| format!("读取响应失败：{}", e))?;

    if !status_code.is_success() {
        return Err(format!("查询失败({}): {}", status_code.as_u16(), text));
    }

    let parsed: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("响应 JSON 解析失败：{}", e))?;

    eprintln!("[poll_video_job_http] 响应内容: {}", text);

    // 解析状态 - 火山方舟状态: pending / processing / succeeded / failed
    let api_status = parsed
        .pointer("/status")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");

    let progress = parsed
        .pointer("/progress")
        .and_then(|v| v.as_f64());

    let error = parsed
        .pointer("/error/message")
        .or_else(|| parsed.pointer("/error"))
        .and_then(|v| v.as_str())
        .map(String::from);

    let status = map_seedance_task_status(api_status);

    // 如果成功，下载视频并落盘
    if status == "succeeded" {
        if let Some(existing) = project_asset_store::find_existing_gen_asset_by_job_id(
            Path::new(project_path),
            "video",
            job_id,
        )? {
            return Ok(VideoJobSnapshot {
                id: job_id.to_string(),
                status: "succeeded".into(),
                progress: Some(1.0),
                error: None,
                model_id: model_id.to_string(),
                result_rel_path: Some(existing),
            });
        }

        let video_url = parse_video_url_from_task_json(&parsed);

        if let Some(url) = video_url.as_deref() {
            match download_video_to_assets(
                http.clone(),
                url,
                project_path,
                node_id,
                workflow,
                Some(job_id),
            )
            .await
            {
                Ok(rel_path) => {
                    return Ok(VideoJobSnapshot {
                        id: job_id.to_string(),
                        status: "succeeded".into(),
                        progress: Some(1.0),
                        error: None,
                        model_id: model_id.to_string(),
                        result_rel_path: Some(rel_path),
                    });
                }
                Err(e) => {
                    eprintln!("[video_cmd] 下载视频失败：{}", e);
                }
            }
        }

        return Ok(VideoJobSnapshot {
            id: job_id.to_string(),
            status: "failed".into(),
            progress,
            error: Some("未获取到视频URL".to_string()),
            model_id: model_id.to_string(),
            result_rel_path: None,
        });
    }

    Ok(VideoJobSnapshot {
        id: job_id.to_string(),
        status: status.into(),
        progress,
        error,
        model_id: model_id.to_string(),
        result_rel_path: None,
    })
}

/// 下载视频到工程 `assets/gen/video/seedance/`
async fn download_video_to_assets(
    http: reqwest::Client,
    url: &str,
    project_path: &str,
    node_id: Option<&str>,
    workflow: Option<&str>,
    job_id: Option<&str>,
) -> Result<String, String> {
    let resp = http
        .get(url)
        .send()
        .await
        .map_err(|e| format!("下载视频请求失败：{}", e))?;

    if !resp.status().is_success() {
        return Err(format!("下载失败：{}", resp.status()));
    }

    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("读取视频内容失败：{}", e))?;

    let root = PathBuf::from(project_path);
    let ctx = AssetWriteContext {
        kind: "video",
        source: "seedance",
        workflow,
        node_id,
        job_id,
    };
    project_asset_store::write_bytes_to_project_asset(&root, &bytes, "mp4", &ctx)
}

#[tauri::command]
pub async fn video_gen_start(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    dreamina: tauri::State<'_, DreaminaCliState>,
    req: VideoGenerationStartRequest,
) -> Result<VideoGenStartResponse, String> {
    // 完整打印收到的请求（用于调试）
    eprintln!(
        "[video_gen_start] project_path={}, node_id={}, model_id={}, workflow={}, prompt_len={}, images={}, videos={}, audios={}",
        req.project_path,
        req.node_id,
        req.payload.model_id,
        req.payload.workflow,
        req.payload.prompt.len(),
        req.payload.reference_image_paths.as_ref().map(|v| v.len()).unwrap_or(0),
        req.payload.reference_video_paths.as_ref().map(|v| v.len()).unwrap_or(0),
        req.payload.reference_audio_paths.as_ref().map(|v| v.len()).unwrap_or(0),
    );

    if req.project_path.trim().is_empty() {
        return Err("projectPath 不能为空".into());
    }
    if req.node_id.trim().is_empty() {
        return Err("nodeId 不能为空".into());
    }
    let model_id = req.payload.model_id.trim().to_string();
    if model_id.is_empty() {
        return Err("payload.modelId 不能为空".into());
    }

    eprintln!("[video_gen_start] project_path={}, node_id={}, model_id={}", req.project_path, req.node_id, model_id);

    let is_dreamina = dreamina_gen::is_dreamina_model(&model_id);
    let workflow = req.payload.workflow.clone();

    let job_id = if is_dreamina {
        eprintln!("[video_gen_start] 即梦 CLI 路由");
        dreamina_gen::submit_video_via_cli(&dreamina, &state.http, &req).await?
    } else {
        match submit_video_job_http(&app, &state.http, &req).await {
            Ok(id) => {
                eprintln!("[video_gen_start] 成功，job_id={}", id);
                id
            }
            Err(e) => {
                eprintln!("[video_gen_start] 失败: {}", e);
                return Err(e);
            }
        }
    };

    let mut map = state
        .video_jobs
        .lock()
        .map_err(|_| "video_jobs 锁异常".to_string())?;
    let job_record = VideoMockJob {
        job_id: job_id.clone(),
        project_path: req.project_path.trim().to_string(),
        node_id: req.node_id.trim().to_string(),
        model_id: model_id.clone(),
        polls: 0,
        result_rel_path: None,
        cancelled: false,
        is_dreamina,
        dreamina_workflow: Some(workflow),
    };
    map.insert(job_id.clone(), job_record.clone());
    drop(map);
    if let Err(e) = persist_video_job(req.project_path.trim(), &job_id, &job_record) {
        eprintln!("[video_gen_start] 持久化 video job 失败（不影响提交）: {e}");
    }
    Ok(VideoGenStartResponse { job_id })
}

#[tauri::command]
pub async fn video_gen_get_job(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    job_id: String,
    hint: Option<VideoJobPollHint>,
) -> Result<VideoJobSnapshot, String> {
    let id = job_id.trim();
    if id.is_empty() {
        return Err("jobId 不能为空".into());
    }

    // 内存表丢失：凭工程持久化 + 轮询上下文恢复（热重载/重启后仍可取回即梦成片）
    {
        let in_map = state
            .video_jobs
            .lock()
            .map_err(|_| "video_jobs 锁异常".to_string())?
            .contains_key(id);
        if !in_map {
            let fallback_model = hint
                .as_ref()
                .map(|h| h.model_id.trim().to_string())
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| "doubao_seedance_2_0".into());

            if let Some(ref h) = hint {
                if !h.project_path.trim().is_empty() {
                    let disk = load_persisted_video_job(h.project_path.trim(), id).ok().flatten();
                    if let Some(ref d) = disk {
                        if let Some(snap) = succeeded_snapshot_from_persisted_job(id, d) {
                            restore_video_job_to_memory(&state, id, d);
                            return Ok(snap);
                        }
                    }
                    match poll_orphaned_video_job(&app, &state, id, h, disk).await {
                        Ok(snap) => return Ok(snap),
                        Err(e) => eprintln!("[video_cmd] 孤儿任务恢复轮询失败: {e}"),
                    }
                }
            }
            return Ok(job_not_found_snapshot(id, &fallback_model));
        }
    }

    // ============================================================
    // 阶段 1：快速路径（不持有锁的分支）
    // ============================================================
    let dreamina_poll_ctx = {
        let mut map = state.video_jobs.lock().map_err(|_| "video_jobs 锁异常".to_string())?;
        let Some(j) = map.get_mut(id) else {
            return Ok(job_not_found_snapshot(id, "doubao_seedance_2_0"));
        };

        if j.cancelled {
            return Ok(VideoJobSnapshot {
                id: id.to_string(),
                status: "cancelled".into(),
                progress: Some(1.0),
                error: Some("任务已取消".into()),
                model_id: j.model_id.clone(),
                result_rel_path: None,
            });
        }

        if j.result_rel_path.is_some() {
            let rel = j.result_rel_path.clone();
            let mid = j.model_id.clone();
            return Ok(VideoJobSnapshot {
                id: id.to_string(),
                status: "succeeded".into(),
                progress: Some(1.0),
                error: None,
                model_id: mid,
                result_rel_path: rel,
            });
        }

        if j.is_dreamina {
            j.polls += 1;
            let poll_count = j.polls;
            Some((
                j.project_path.clone(),
                j.model_id.clone(),
                j.dreamina_workflow.clone().unwrap_or_else(|| "text_to_video".into()),
                j.node_id.clone(),
                poll_count,
            ))
        } else {
            j.polls += 1;
            None
        }
    };

    if let Some((project_path, model_id, workflow, node_id, poll_count)) = dreamina_poll_ctx {
        let snap = dreamina_gen::poll_video_via_cli(
            &state.http,
            id,
            &project_path,
            &model_id,
            &workflow,
            Some(node_id.as_str()),
            poll_count,
        )
        .await?;
        {
            let mut map =
                state.video_jobs.lock().map_err(|_| "video_jobs 锁异常".to_string())?;
            if let Some(job) = map.get_mut(id) {
                if snap.status == "succeeded" {
                    if let Some(ref rel) = snap.result_rel_path {
                        job.result_rel_path = Some(rel.clone());
                    }
                }
                let job_clone = job.clone();
                let project = job_clone.project_path.clone();
                drop(map);
                let _ = persist_video_job(&project, id, &job_clone);
            }
        }
        return Ok(snap);
    }

    // ============================================================
    // 阶段 2：第 4 次 poll，开始真实轮询
    // ============================================================
    let job_data = {
        let mut map = state.video_jobs.lock().map_err(|_| "video_jobs 锁异常".to_string())?;
        let Some(j) = map.get_mut(id) else {
            return Ok(VideoJobSnapshot {
                id: id.to_string(),
                status: "failed".into(),
                progress: Some(1.0),
                error: Some("任务不存在".into()),
                model_id: "doubao_seedance_2_0".into(),
                result_rel_path: None,
            });
        };
        if j.result_rel_path.is_some() {
            let rel = j.result_rel_path.clone();
            let mid = j.model_id.clone();
            return Ok(VideoJobSnapshot {
                id: id.to_string(),
                status: "succeeded".into(),
                progress: Some(1.0),
                error: None,
                model_id: mid,
                result_rel_path: rel,
            });
        }
        (
            j.project_path.clone(),
            j.model_id.clone(),
            j.node_id.clone(),
            j.dreamina_workflow.clone(),
            j.polls,
        )
    };

    // 锁已释放，可以安全做 async IO
    let project_path = job_data.0;
    let model_id = job_data.1;
    let node_id = job_data.2;
    let workflow = job_data.3;
    let poll_count = job_data.4;
    let http = state.http.clone();
    let id_owned = id.to_string();

    if !id_owned.starts_with("mock_") {
        match poll_video_job_http(
            &http,
            &id_owned,
            &project_path,
            &model_id,
            &app,
            Some(node_id.as_str()),
            workflow.as_deref(),
        )
        .await
        {
            Ok(snap) if snap.status == "succeeded" && snap.result_rel_path.is_some() => {
                let rel = snap.result_rel_path.clone().unwrap();
                let mut map = state.video_jobs.lock().map_err(|_| "video_jobs 锁异常".to_string())?;
                if let Some(job) = map.get_mut(&id_owned) {
                    job.result_rel_path = Some(rel.clone());
                    let job_clone = job.clone();
                    let project = job_clone.project_path.clone();
                    drop(map);
                    let _ = persist_video_job(&project, &id_owned, &job_clone);
                }
                return Ok(VideoJobSnapshot {
                    id: id_owned,
                    status: "succeeded".into(),
                    progress: Some(1.0),
                    error: None,
                    model_id,
                    result_rel_path: Some(rel),
                });
            }
            Ok(snap) => {
                eprintln!(
                    "[video_cmd] poll_video_job_http 未成功（status={}, error={:?}）",
                    snap.status, snap.error
                );
                let status = if snap.status == "queued" && poll_count >= 2 {
                    "running".to_string()
                } else {
                    snap.status.clone()
                };
                return Ok(VideoJobSnapshot {
                    id: id_owned,
                    status,
                    progress: snap.progress,
                    error: snap.error.clone(),
                    model_id,
                    result_rel_path: None,
                });
            }
            Err(e) => {
                eprintln!("[video_cmd] poll_video_job_http 出错：{}", e);
                // API 调用失败，把错误返回给前端，不 fallback
                return Ok(VideoJobSnapshot {
                    id: id_owned,
                    status: "failed".into(),
                    progress: None,
                    error: Some(e),
                    model_id,
                    result_rel_path: None,
                });
            }
        }
    }

    // ============================================================
    // 降级：使用 ffmpeg 渲染黑屏视频
    // ============================================================
    let app_clone = app.clone();
    let settings = settings::load_settings(&app_clone)?;
    let ffmpeg = resolve_ffmpeg_bin(&settings);
    let root = PathBuf::from(&project_path);
    let ctx = AssetWriteContext {
        kind: "video",
        source: "mock",
        workflow: None,
        node_id: None,
        job_id: Some(id_owned.as_str()),
    };
    let (rel, out_abs) = project_asset_store::allocate_project_asset_paths(&root, "mp4", &ctx)?;
    let status = Command::new(&ffmpeg)
        .args([
            "-y",
            "-f",
            "lavfi",
            "-i",
            "color=c=black:s=640x360:d=2",
            "-f",
            "lavfi",
            "-i",
            "anullsrc=channel_layout=stereo:sample_rate=44100",
            "-shortest",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
        ])
        .arg(&out_abs)
        .status()
        .map_err(|e| format!("无法启动 ffmpeg（{}）：{}", ffmpeg, e))?;
    if !status.success() {
        return Err(format!("ffmpeg 退出码: {:?}", status.code()));
    }
    project_asset_store::register_asset_at_path(&root, &out_abs, &ctx)?;
    let mut map = state.video_jobs.lock().map_err(|_| "video_jobs 锁异常".to_string())?;
    if let Some(j) = map.get_mut(&id_owned) {
        j.result_rel_path = Some(rel.clone());
    }
    Ok(VideoJobSnapshot {
        id: id_owned,
        status: "succeeded".into(),
        progress: Some(1.0),
        error: None,
        model_id,
        result_rel_path: Some(rel),
    })
}

/// 按 submit_id 从即梦取回已在网页端成功的视频成片
#[tauri::command]
pub async fn video_gen_recover_dreamina(
    state: tauri::State<'_, AppState>,
    req: DreaminaVideoRecoverRequest,
) -> Result<VideoJobSnapshot, String> {
    if req.project_path.trim().is_empty() {
        return Err("projectPath 不能为空".into());
    }
    if req.submit_id.trim().is_empty() {
        return Err("submitId 不能为空".into());
    }
    let submit_id = req.submit_id.trim();
    let project_path = req.project_path.trim();
    let snap = dreamina_gen::recover_dreamina_video_job(
        &state.http,
        submit_id,
        project_path,
        req.model_id.trim(),
        req.workflow.as_deref(),
        Some(req.node_id.trim()),
    )
    .await?;

    if snap.status == "succeeded" {
        if let Some(ref rel) = snap.result_rel_path {
            let disk = load_persisted_video_job(project_path, submit_id).ok().flatten();
            let mut job_record = disk.unwrap_or(VideoMockJob {
                job_id: submit_id.to_string(),
                project_path: project_path.to_string(),
                node_id: req.node_id.trim().to_string(),
                model_id: req.model_id.trim().to_string(),
                polls: 0,
                result_rel_path: None,
                cancelled: false,
                is_dreamina: true,
                dreamina_workflow: req.workflow.clone(),
            });
            if job_record.job_id.trim().is_empty() {
                job_record.job_id = submit_id.to_string();
            }
            job_record.result_rel_path = Some(rel.clone());
            job_record.is_dreamina = true;
            restore_video_job_to_memory(&state, submit_id, &job_record);
            let _ = persist_video_job(project_path, submit_id, &job_record);
        }
    }

    Ok(snap)
}

#[cfg(test)]
mod poll_parse_tests {
    use super::{map_seedance_task_status, parse_video_url_from_task_json};
    use serde_json::json;

    #[test]
    fn maps_seedance_status() {
        assert_eq!(map_seedance_task_status("processing"), "running");
        assert_eq!(map_seedance_task_status("succeeded"), "succeeded");
    }

    #[test]
    fn parses_video_url_paths() {
        let v = json!({ "content": { "video_url": "https://example.com/a.mp4" } });
        assert_eq!(
            parse_video_url_from_task_json(&v).as_deref(),
            Some("https://example.com/a.mp4")
        );
        let alt = json!({ "output": { "url": "https://example.com/b.mp4" } });
        assert_eq!(
            parse_video_url_from_task_json(&alt).as_deref(),
            Some("https://example.com/b.mp4")
        );
    }
}

fn list_persisted_video_jobs_on_disk(project_path: &str) -> Result<Vec<PersistedVideoJobEntry>, String> {
    let dir = video_jobs_dir(project_path);
    if !dir.is_dir() {
        return Ok(vec![]);
    }
    let mut out = Vec::new();
    for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("json") {
            continue;
        }
        let stem_job_id = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .trim()
            .to_string();
        if stem_job_id.is_empty() {
            continue;
        }
        let modified_at_ms = entry
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        let raw = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let job: VideoMockJob = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
        if job.node_id.trim().is_empty() {
            continue;
        }
        let job_id = if job.job_id.trim().is_empty() {
            stem_job_id.clone()
        } else {
            job.job_id.trim().to_string()
        };
        out.push(PersistedVideoJobEntry {
            job_id,
            project_path: job.project_path,
            node_id: job.node_id,
            model_id: job.model_id,
            polls: job.polls,
            result_rel_path: job.result_rel_path,
            cancelled: job.cancelled,
            is_dreamina: job.is_dreamina,
            dreamina_workflow: job.dreamina_workflow,
            modified_at_ms,
        });
    }
    out.sort_by(|a, b| a.job_id.cmp(&b.job_id));
    Ok(out)
}

#[tauri::command]
pub fn video_gen_list_persisted_jobs(project_path: String) -> Result<Vec<PersistedVideoJobEntry>, String> {
    let path = project_path.trim();
    if path.is_empty() {
        return Err("projectPath 不能为空".into());
    }
    list_persisted_video_jobs_on_disk(path)
}

#[tauri::command]
pub async fn video_gen_cancel(
    state: tauri::State<'_, AppState>,
    job_id: String,
) -> Result<(), String> {
    let id = job_id.trim();
    if id.is_empty() {
        return Err("jobId 不能为空".into());
    }
    let mut map = state
        .video_jobs
        .lock()
        .map_err(|_| "video_jobs 锁异常".to_string())?;
    if let Some(j) = map.get_mut(id) {
        j.cancelled = true;
    }
    Ok(())
}

/// 设置页：探测视频模型 API（GET /models，与图片模型测试一致）
#[tauri::command]
pub async fn test_video_model_connection(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    video_model_id: String,
    api_key_override: Option<String>,
) -> Result<String, String> {
    let settings = settings::load_settings(&app)?;
    let cfg = settings
        .video_models
        .iter()
        .find(|m| m.id == video_model_id)
        .ok_or_else(|| "未找到视频模型配置".to_string())?;

    if cfg.model.trim().is_empty() {
        return Err("请先填写模型标识".into());
    }

    let api_key = if let Some(v) = api_key_override {
        if v.trim().is_empty() {
            return Err("API Key 为空".into());
        }
        v.trim().to_string()
    } else {
        let key_id = format!("video-model:{}", cfg.id);
        get_api_key(&key_id)?.ok_or_else(|| "请先填写并保存 API Key".to_string())?
    };

    let base_url = {
        let raw = if cfg.api_base_url.trim().is_empty() {
            DEFAULT_SEEDANCE_API_BASE.to_string()
        } else {
            cfg.api_base_url.trim().to_string()
        };
        let normalized = normalize_openai_api_base(&raw);
        if normalized.is_empty() {
            DEFAULT_SEEDANCE_API_BASE.to_string()
        } else {
            normalized
        }
    };
    let model_id = cfg.model.trim();
    let url = format!("{}/models", base_url.trim_end_matches('/'));

    let resp = state
        .http
        .get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| format!("连接失败：{}", e))?;

    let status = resp.status();
    let text = resp.text().await.map_err(|e| e.to_string())?;
    if status.as_u16() == 401 || status.as_u16() == 403 {
        return Err(format!(
            "API Key 无效或无权访问（{}）：请检查火山方舟控制台密钥与接入点权限",
            status.as_u16()
        ));
    }
    if !status.is_success() {
        return Err(format!(
            "连接失败({})：{}",
            status.as_u16(),
            text.chars().take(240).collect::<String>()
        ));
    }

    let parsed: serde_json::Value =
        serde_json::from_str(&text).unwrap_or_else(|_| serde_json::json!({ "raw": text }));
    let model_listed = parsed
        .get("data")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter().any(|m| {
                m.get("id")
                    .and_then(|id| id.as_str())
                    .map(|id| id == model_id)
                    .unwrap_or(false)
            })
        })
        .unwrap_or(false);

    let model_label = if cfg.label.trim().is_empty() {
        model_id
    } else {
        cfg.label.as_str()
    };

    if model_listed {
        Ok(format!(
            "连接成功：已确认模型「{}」({}) 在接入点可用",
            model_label, model_id
        ))
    } else {
        Ok(format!(
            "连接成功（API 可达），模型列表中未找到「{}」。若视频生成正常可忽略；否则请核对火山方舟接入点 ID 是否为 {}",
            model_id, model_id
        ))
    }
}

#[cfg(test)]
mod video_model_match_tests {
    use super::*;
    use crate::settings::ImageModelConfig;

    fn doubao_preset(model: &str) -> ImageModelConfig {
        ImageModelConfig {
            id: "preset-video-doubao-seedance".into(),
            vendor_name: String::new(),
            model_name: String::new(),
            model_variant: String::new(),
            label: "Doubao Seedance 2.0".into(),
            model: model.into(),
            api_base_url: String::new(),
            enabled: true,
            priority: 0,
            supports_multi_ref_fusion: true,
            max_reference_images: 4,
            supports_image_edit: true,
            endpoint_type: None,
        }
    }

    #[test]
    fn matches_canvas_canonical_id_against_api_model_settings() {
        let cfg = doubao_preset(DOUBAO_SEEDANCE_API_MODEL);
        assert!(video_model_config_matches(&cfg, DOUBAO_SEEDANCE_CANONICAL_ID));
    }

    #[test]
    fn maps_legacy_slug_to_api_model() {
        let cfg = doubao_preset(DOUBAO_SEEDANCE_CANONICAL_ID);
        assert_eq!(seedance_api_model_id(&cfg), DOUBAO_SEEDANCE_API_MODEL);
    }
}
