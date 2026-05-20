//! 视频生成供应商适配（当前默认 Doubao Seedance 2.0）。
//!
//! 核心链路：
//! 1. video_gen_start  -> 提交任务到供应商，返回 jobId
//! 2. video_gen_get_job -> 轮询供应商接口，状态 succeeded 时下载视频落盘

use crate::command_common::resolve_ffmpeg_bin;
use crate::commands::types::{VideoGenStartResponse, VideoGenerationStartRequest, VideoJobSnapshot};
use crate::db;
use crate::dreamina_cli::DreaminaCliState;
use crate::dreamina_gen;
use crate::media;
use crate::settings;
use crate::vault::get_api_key;
use crate::AppState;
use crate::VideoMockJob;
use serde_json::json;
use std::path::PathBuf;
use std::process::Command;

/// Doubao Seedance API 基址
const DEFAULT_SEEDANCE_API_BASE: &str = "https://ark.cn-beijing.volces.com/api/v3";

/// 从 settings 中解析视频模型配置
fn resolve_video_model_config(
    app: &tauri::AppHandle,
    model_id: &str,
) -> Result<(String, String), String> {
    let app_settings = settings::load_settings(app)?;
    // 用 model 字段（真实 API 标识，如 "doubao-seedance-2-0-260128"）匹配
    let cfg = app_settings
        .video_models
        .iter()
        .find(|m| m.model == model_id && m.enabled)
        .ok_or_else(|| format!("视频模型不存在或已禁用：{}（请确认模型标识与 Settings 中填写的值一致）", model_id))?;

    let key_id = format!("video-model:{}", cfg.id);
    let api_key =
        get_api_key(&key_id)?.ok_or_else(|| format!("未配置视频模型 API Key：{}", cfg.label))?;

    let base_url = if cfg.api_base_url.trim().is_empty() {
        DEFAULT_SEEDANCE_API_BASE.to_string()
    } else {
        cfg.api_base_url.trim().to_string()
    };

    Ok((base_url, api_key))
}

/// 调用 Seedance 提交视频生成任务
/// API: POST https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks
async fn submit_video_job_http(
    app: &tauri::AppHandle,
    http: &reqwest::Client,
    req: &VideoGenerationStartRequest,
) -> Result<String, String> {
    let (base_url, api_key) = resolve_video_model_config(app, &req.payload.model_id)?;

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
        "model": req.payload.model_id,
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

/// 轮询视频任务状态
/// API: GET https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/{id}
async fn poll_video_job_http(
    http: &reqwest::Client,
    job_id: &str,
    project_path: &str,
    model_id: &str,
    app: &tauri::AppHandle,
) -> Result<VideoJobSnapshot, String> {
    let (base_url, api_key) = resolve_video_model_config(app, model_id)?;
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

    // Map API status to our status
    let status = match api_status {
        "pending" | "queued" => "queued",
        "processing" | "running" => "running",
        "succeeded" | "success" | "completed" => "succeeded",
        "failed" | "error" => "failed",
        _ => "running",
    };

    // 如果成功，下载视频并落盘
    if status == "succeeded" {
        // 视频 URL 在 content.video_url（火山方舟 API 返回格式）
        let video_url = parsed
            .pointer("/content/video_url")
            .or_else(|| parsed.pointer("/content/url"))
            .and_then(|v| v.as_str());

        eprintln!(
            "[poll_video_job_http] video_url 解析结果: {:?}",
            video_url
        );

        if let Some(url) = video_url {
            eprintln!("[poll_video_job_http] 找到视频URL: {}", url);
            match download_video_to_assets(http.clone(), url, project_path).await {
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

/// 下载视频到工程 assets/ 目录
async fn download_video_to_assets(
    http: reqwest::Client,
    url: &str,
    project_path: &str,
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
    let assets_dir = root.join("assets");
    std::fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;

    let file_name = format!(
        "seedance_{}_{}.mp4",
        chrono::Utc::now().format("%Y%m%d_%H%M%S"),
        &uuid::Uuid::new_v4().to_string()[..8]
    );
    let out_path = assets_dir.join(&file_name);
    std::fs::write(&out_path, &bytes).map_err(|e| format!("保存视频失败：{}", e))?;

    let rel_path = format!("assets/{}", file_name);

    // 登记到数据库
    let conn = db::open_run_db(&root)?;
    let meta_json = media::meta_json_for_av(&out_path, "video");
    let _aid = db::upsert_asset(
        &conn,
        &rel_path,
        "video",
        Some("seedance"),
        meta_json.as_deref(),
    )?;

    Ok(rel_path)
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
    map.insert(
        job_id.clone(),
        VideoMockJob {
            project_path: req.project_path.trim().to_string(),
            node_id: req.node_id.trim().to_string(),
            model_id,
            polls: 0,
            result_rel_path: None,
            cancelled: false,
            is_dreamina,
            dreamina_workflow: if is_dreamina {
                Some(workflow)
            } else {
                None
            },
        },
    );
    Ok(VideoGenStartResponse { job_id })
}

#[tauri::command]
pub async fn video_gen_get_job(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    job_id: String,
) -> Result<VideoJobSnapshot, String> {
    let id = job_id.trim();
    if id.is_empty() {
        return Err("jobId 不能为空".into());
    }

    // ============================================================
    // 阶段 1：快速路径（不持有锁的分支）
    // ============================================================
    let dreamina_poll_ctx = {
        let mut map = state.video_jobs.lock().map_err(|_| "video_jobs 锁异常".to_string())?;
        let Some(j) = map.get_mut(id) else {
            return Ok(VideoJobSnapshot {
                id: id.to_string(),
                status: "failed".into(),
                progress: None,
                error: Some("任务不存在（可能已过期）".into()),
                model_id: "doubao_seedance_2_0".into(),
                result_rel_path: None,
            });
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
            Some((
                j.project_path.clone(),
                j.model_id.clone(),
                j.dreamina_workflow.clone().unwrap_or_else(|| "text_to_video".into()),
            ))
        } else {
            j.polls += 1;
            if j.polls < 4 {
                let st = if j.polls == 1 { "queued" } else { "running" };
                let p = (j.polls as f64) * 0.25;
                return Ok(VideoJobSnapshot {
                    id: id.to_string(),
                    status: st.into(),
                    progress: Some(p.min(0.95)),
                    error: None,
                    model_id: j.model_id.clone(),
                    result_rel_path: None,
                });
            }
            None
        }
    };

    if let Some((project_path, model_id, workflow)) = dreamina_poll_ctx {
        let snap = dreamina_gen::poll_video_via_cli(
            &state.http,
            id,
            &project_path,
            &model_id,
            &workflow,
        )
        .await?;
        if snap.status == "succeeded" {
            if let Some(ref rel) = snap.result_rel_path {
                let mut map =
                    state.video_jobs.lock().map_err(|_| "video_jobs 锁异常".to_string())?;
                if let Some(job) = map.get_mut(id) {
                    job.result_rel_path = Some(rel.clone());
                }
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
        (j.project_path.clone(), j.model_id.clone())
    };

    // 锁已释放，可以安全做 async IO
    let project_path = job_data.0;
    let model_id = job_data.1;
    let http = state.http.clone();
    let id_owned = id.to_string();

    if !id_owned.starts_with("mock_") {
        match poll_video_job_http(&http, &id_owned, &project_path, &model_id, &app).await {
            Ok(snap) if snap.status == "succeeded" && snap.result_rel_path.is_some() => {
                let rel = snap.result_rel_path.clone().unwrap();
                let mut map = state.video_jobs.lock().map_err(|_| "video_jobs 锁异常".to_string())?;
                if let Some(job) = map.get_mut(&id_owned) {
                    job.result_rel_path = Some(rel.clone());
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
                // API 返回了状态但未成功，把真实状态返回给前端，不 fallback
                return Ok(VideoJobSnapshot {
                    id: id_owned,
                    status: snap.status,
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
    let assets_dir = root.join("assets");
    std::fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;
    let file_name = format!(
        "mock_video_{}_{}.mp4",
        chrono::Utc::now().format("%Y%m%d_%H%M%S"),
        &uuid::Uuid::new_v4().to_string()[..8]
    );
    let out_abs = assets_dir.join(&file_name);
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
    let rel = format!("assets/{}", file_name);
    let conn = db::open_run_db(&root)?;
    let meta_json = media::meta_json_for_av(&out_abs, "video");
    let _aid = db::upsert_asset(&conn, &rel, "video", Some("mock-video"), meta_json.as_deref())?;
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
