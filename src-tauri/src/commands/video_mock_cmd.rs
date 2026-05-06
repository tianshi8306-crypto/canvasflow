use crate::command_common::resolve_ffmpeg_bin;
use crate::commands::types::{VideoGenStartResponse, VideoGenerationStartRequest, VideoJobSnapshot};
use crate::db;
use crate::media;
use crate::settings;
use crate::AppState;
use crate::VideoMockJob;
use std::path::PathBuf;
use std::process::Command;

fn mock_render_video_with_ffmpeg(ffmpeg: &str, out_abs: &PathBuf) -> Result<(), String> {
    let status = Command::new(ffmpeg)
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
            &out_abs.to_string_lossy(),
        ])
        .status()
        .map_err(|e| format!("无法启动 ffmpeg（{}）：{}", ffmpeg, e))?;
    if !status.success() {
        return Err(format!("ffmpeg 退出码: {:?}", status.code()));
    }
    Ok(())
}

/// Mock：启动一个视频生成任务（用于联调视频节点状态机与落盘链路）。
#[tauri::command]
pub async fn video_gen_start(
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
    let job_id = format!("mock_{}", uuid::Uuid::new_v4());
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
pub async fn video_gen_cancel(state: tauri::State<'_, AppState>, job_id: String) -> Result<(), String> {
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
    let mut map = state
        .video_jobs
        .lock()
        .map_err(|_| "video_jobs 锁异常".to_string())?;
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
    let polls = j.polls;
    if polls < 4 {
        let st = if polls == 1 { "queued" } else { "running" };
        let p = (polls as f64) * 0.25;
        return Ok(VideoJobSnapshot {
            id: id.to_string(),
            status: st.into(),
            progress: Some(p.min(0.95)),
            error: None,
            model_id: j.model_id.clone(),
            result_rel_path: None,
        });
    }

    if j.result_rel_path.is_none() {
        let settings = settings::load_settings(&app)?;
        let ffmpeg = resolve_ffmpeg_bin(&settings);
        let root = PathBuf::from(&j.project_path);
        let assets_dir = root.join("assets");
        std::fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;
        let file_name = format!(
            "mock_video_{}_{}.mp4",
            chrono::Utc::now().format("%Y%m%d_%H%M%S"),
            &uuid::Uuid::new_v4().to_string()[..8]
        );
        let out_abs = assets_dir.join(&file_name);
        mock_render_video_with_ffmpeg(&ffmpeg, &out_abs)?;

        let rel = format!("assets/{}", file_name);
        let conn = db::open_run_db(&root)?;
        let meta_json = media::meta_json_for_av(&out_abs, "video");
        let _aid = db::upsert_asset(&conn, &rel, "video", Some("mock-video"), meta_json.as_deref())?;
        j.result_rel_path = Some(rel);
    }

    Ok(VideoJobSnapshot {
        id: id.to_string(),
        status: "succeeded".into(),
        progress: Some(1.0),
        error: None,
        model_id: j.model_id.clone(),
        result_rel_path: j.result_rel_path.clone(),
    })
}
