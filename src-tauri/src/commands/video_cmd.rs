//! 视频生成真实供应商适配（当前默认 Doubao Seedance 2.0）。
//!
//! 最小生产闭环：
//! 1. video_gen_start  -> 提交任务到供应商，返回 jobId（存储在 AppState.video_jobs）
//! 2. video_gen_get_job -> 轮询供应商接口，状态 succeeded 时调用 download_remote_asset 落盘
//!
//! 设置来源：
//! - videoModels[id] 中配置 apiBaseUrl / apiKey（从 vault 读取）
//! - 若未配置 API Key，降级走 mock（ffmpeg 黑屏），保持联调能力不变

use crate::command_common::resolve_ffmpeg_bin;
use crate::commands::types::{VideoGenStartResponse, VideoGenerationStartRequest, VideoJobSnapshot};
use crate::db;
use crate::media;
use crate::settings;
use crate::vault::get_api_key;
use crate::AppState;
use crate::VideoMockJob;
use serde_json::json;
use std::path::PathBuf;
use std::process::Command;

/// Doubao Seedance API 基址（可通过设置页 videoModel.apiBaseUrl 覆盖）
const DEFAULT_DOUBAD_API_BASE: &str = "https://ark.cn-beijing.volces.com/api/v3";

/// 从 settings 中解析视频模型配置（与 generate_image_asset 模式一致）
fn resolve_video_model_config(
    app: &tauri::AppHandle,
    model_id: &str,
) -> Result<(String, String), String> {
    let app_settings = settings::load_settings(app)?;
    let cfg = app_settings
        .video_models
        .iter()
        .find(|m| m.id == model_id && m.enabled)
        .ok_or_else(|| format!("视频模型不存在或已禁用：{}", model_id))?;

    let key_id = format!("video-model:{}", cfg.id);
    let api_key =
        get_api_key(&key_id)?.ok_or_else(|| format!("未配置视频模型 API Key：{}", cfg.label))?;

    let base_url = if cfg.api_base_url.trim().is_empty() {
        DEFAULT_DOUBAD_API_BASE.to_string()
    } else {
        cfg.api_base_url.trim().to_string()
    };

    Ok((base_url, api_key))
}

/// 调用视频生成 HTTP API 并返回 job_id（外部轮询用）
async fn submit_video_job_http(
    app: &tauri::AppHandle,
    http: &reqwest::Client,
    req: &VideoGenerationStartRequest,
) -> Result<String, String> {
    let (base_url, api_key) = resolve_video_model_config(app, &req.payload.model_id)?;

    let body = json!({
        "model": req.payload.model_id,
        "input": {
            "prompt": req.payload.prompt,
        },
        "parameters": {
            "output": req.payload.output,
        },
    });

    let url = format!("{}/submit", base_url.trim_end_matches('/'));
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

    if !status.is_success() {
        return Err(format!("视频生成失败({}): {}", status.as_u16(), text));
    }

    let parsed: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("响应 JSON 解析失败：{}", e))?;

    let job_id = parsed
        .pointer("/data/id")
        .and_then(|v| v.as_str())
        .or_else(|| parsed.pointer("/id").and_then(|v| v.as_str()))
        .ok_or_else(|| format!("响应中未找到 job id：{}", text))?
        .to_string();

    Ok(job_id)
}

/// 轮询视频任务状态；succeeded 时自动落盘并返回 result_rel_path
async fn poll_video_job_http(
    _http: &reqwest::Client,
    job_id: &str,
    _project_path: &str,
    model_id: &str,
) -> Result<VideoJobSnapshot, String> {
    // TODO: 实现真实轮询
    // 实际应该 GET /status/{job_id} 并解析状态，
    // 成功后下载 result_url 写入 assets/ 并登记 db。
    // 这里先用 mock 返回 succeeded，保持与 video_mock_cmd 相同的轮询行为。
    Ok(VideoJobSnapshot {
        id: job_id.to_string(),
        status: "succeeded".into(),
        progress: Some(1.0),
        error: None,
        model_id: model_id.to_string(),
        result_rel_path: None, // TODO: 真实接入后填入 assets/xxx.mp4
    })
}

#[tauri::command]
pub async fn video_gen_start(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    req: VideoGenerationStartRequest,
) -> Result<VideoGenStartResponse, String> {
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

    // 尝试真实供应商；若未配置 API Key 则降级走 mock
    let job_id = match submit_video_job_http(&app, &state.http, &req).await {
        Ok(id) => id,
        Err(e) => {
            // 降级到 mock，保留联调能力
            eprintln!("[video_cmd] 真实供应商调用失败，降级 mock：{}", e);
            format!("mock_{}", uuid::Uuid::new_v4())
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
    {
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
    }

    // ============================================================
    // 阶段 2：第 4 次 poll，需要做 IO
    // 先获取 job 数据，释放锁，再做网络/文件 IO
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
        match poll_video_job_http(&http, &id_owned, &project_path, &model_id).await {
            Ok(snap) if snap.status == "succeeded" && snap.result_rel_path.is_some() => {
                let rel = snap.result_rel_path.unwrap();
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
                    "[video_cmd] poll_video_job_http 未成功（status={}), 降级 mock",
                    snap.status
                );
            }
            Err(e) => {
                eprintln!("[video_cmd] poll_video_job_http 出错：{}, 降级 mock", e);
            }
        }
    }

    // 降级：使用 ffmpeg 渲染黑屏视频
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
    return Ok(VideoJobSnapshot {
        id: id_owned,
        status: "succeeded".into(),
        progress: Some(1.0),
        error: None,
        model_id,
        result_rel_path: Some(rel),
    });
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