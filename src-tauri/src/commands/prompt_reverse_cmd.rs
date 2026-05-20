//! 图/视频 → 下游文本：多模态 LLM 反推提示词

use crate::command_common::resolve_ffmpeg_bin_auto;
use crate::executor::openai_chat_completion;
use crate::settings;
use crate::AppState;
use base64::Engine;
use serde_json::json;
use std::path::{Path, PathBuf};
use std::process::Command;

const DEFAULT_IMAGE_INSTRUCTION: &str =
    "根据图片生成结构化中文提示词，包括主体描述、环境、光影、镜头语言、风格关键词。只输出提示词正文，不要解释。";

const DEFAULT_VIDEO_INSTRUCTION: &str =
    "根据视频画面（关键帧）反推可用于文生视频的中文提示词，包括主体、动作、环境、镜头与风格关键词。只输出提示词正文，不要解释。";

fn mime_for_image_path(p: &Path) -> &'static str {
    match p
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "png" => "image/png",
        "webp" => "image/webp",
        "gif" => "image/gif",
        _ => "image/jpeg",
    }
}

fn image_abs_to_data_url(abs: &Path) -> Result<String, String> {
    let bytes = std::fs::read(abs).map_err(|e| format!("读取图片失败: {}", e))?;
    if bytes.is_empty() {
        return Err("图片文件为空".into());
    }
    let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
    Ok(format!(
        "data:{};base64,{}",
        mime_for_image_path(abs),
        b64
    ))
}

fn escape_ffmpeg_path(p: &Path) -> String {
    let s = p.to_string_lossy();
    if s.contains(' ') || s.contains('\'') {
        format!("'{}'", s.replace('\'', "'\\''"))
    } else {
        s.into_owned()
    }
}

fn extract_video_keyframe(ffmpeg: &str, video_abs: &Path, out_jpg: &Path) -> Result<(), String> {
    if let Some(parent) = out_jpg.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let status = Command::new(ffmpeg)
        .args([
            "-y",
            "-ss",
            "0.5",
            "-i",
            &escape_ffmpeg_path(video_abs),
            "-vframes",
            "1",
            "-q:v",
            "2",
            &escape_ffmpeg_path(out_jpg),
        ])
        .status()
        .map_err(|e| format!("无法执行 ffmpeg: {}", e))?;
    if !status.success() || !out_jpg.is_file() {
        return Err("无法从视频提取关键帧，请确认已安装 ffmpeg".into());
    }
    Ok(())
}

#[tauri::command]
pub async fn reverse_prompt_from_media(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    project_path: String,
    media_rel_path: String,
    media_kind: String,
    user_instruction: Option<String>,
    provider_id: Option<String>,
    model: Option<String>,
) -> Result<String, String> {
    let root = PathBuf::from(project_path.trim());
    if !root.is_dir() {
        return Err("工程目录无效".into());
    }
    let rel = media_rel_path.trim();
    if rel.is_empty() {
        return Err("媒体路径为空".into());
    }
    let media_abs = root.join(rel);
    if !media_abs.is_file() {
        return Err(format!("媒体文件不存在：{}", media_abs.display()));
    }

    let settings = settings::load_settings(&app)?;
    let ffmpeg = resolve_ffmpeg_bin_auto(&app, &settings);

    let temp_frame: Option<PathBuf> = match media_kind.as_str() {
        "image" => None,
        "video" => {
            let ts = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis())
                .unwrap_or(0);
            let tmp = root
                .join(".canvasflow")
                .join("tmp")
                .join(format!("reverse-frame-{}.jpg", ts));
            extract_video_keyframe(&ffmpeg, &media_abs, &tmp)?;
            Some(tmp)
        }
        other => return Err(format!("不支持的媒体类型：{}", other)),
    };

    let frame_abs = temp_frame
        .as_ref()
        .map(|p| p.as_path())
        .unwrap_or(media_abs.as_path());

    let data_url = image_abs_to_data_url(frame_abs)?;
    let instruction = user_instruction
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| {
            if media_kind == "video" {
                DEFAULT_VIDEO_INSTRUCTION.to_string()
            } else {
                DEFAULT_IMAGE_INSTRUCTION.to_string()
            }
        });

    let messages = json!([{
        "role": "user",
        "content": [
            { "type": "text", "text": instruction },
            { "type": "image_url", "image_url": { "url": data_url } }
        ]
    }]);

    let mut extra = json!({});
    if let Some(pid) = provider_id.filter(|s| !s.trim().is_empty()) {
        extra["providerId"] = json!(pid.trim());
    }
    if let Some(m) = model.filter(|s| !s.trim().is_empty()) {
        extra["model"] = json!(m.trim());
    }

    let result = openai_chat_completion(&state.http, &settings, messages, &extra).await;
    if let Some(ref tmp) = temp_frame {
        let _ = std::fs::remove_file(tmp);
    }
    let content = result?;
    let trimmed = content.trim();
    if trimmed.is_empty() {
        return Err("模型返回为空".into());
    }
    Ok(trimmed.to_string())
}
