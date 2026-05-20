//! 各 Tauri command 共用的辅助函数（FFmpeg 解析、素材类型、工程 asset scope 等）。

use crate::settings::{self, AppSettings};
use std::path::PathBuf;
use tauri::Manager;

pub fn pick_enabled_provider(settings: &AppSettings) -> Result<settings::ProviderConfig, String> {
    let mut list: Vec<settings::ProviderConfig> = settings
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

pub fn media_type_from_ext(ext: &str) -> &'static str {
    match ext.to_ascii_lowercase().as_str() {
        "png" | "jpg" | "jpeg" | "webp" | "bmp" | "gif" => "image",
        "mp4" | "mov" | "webm" | "avi" | "mkv" | "m4v" | "mpeg" | "mpg" => "video",
        "mp3" | "wav" | "m4a" | "flac" | "ogg" => "audio",
        _ => "file",
    }
}

pub fn resolve_ffmpeg_bin(settings: &AppSettings) -> String {
    settings
        .ffmpeg_path
        .clone()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "ffmpeg".into())
}

pub fn resolve_bundled_ffmpeg(app: &tauri::AppHandle) -> Option<String> {
    let exe = if cfg!(windows) { "ffmpeg.exe" } else { "ffmpeg" };
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(dir) = app.path().resource_dir() {
        candidates.push(dir.join(exe));
        candidates.push(dir.join("bin").join(exe));
    }
    if let Ok(cur) = std::env::current_exe() {
        if let Some(parent) = cur.parent() {
            candidates.push(parent.join(exe));
            candidates.push(parent.join("bin").join(exe));
        }
    }
    for p in candidates {
        if p.exists() {
            return Some(p.to_string_lossy().to_string());
        }
    }
    None
}

pub fn resolve_ffmpeg_bin_auto(app: &tauri::AppHandle, settings: &AppSettings) -> String {
    if let Some(p) = settings.ffmpeg_path.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
        let pb = PathBuf::from(p);
        if pb.exists() {
            return p.to_string();
        }
    }
    if let Some(p) = resolve_bundled_ffmpeg(app) {
        return p;
    }
    "ffmpeg".into()
}

/// 仅允许当前工程根目录下的文件通过 `asset` / `convertFileSrc` 预览（运行时追加，不放开整盘）。
pub fn register_project_asset_scope(app: &tauri::AppHandle, project_path: &str) -> Result<(), String> {
    let root = PathBuf::from(project_path);
    let root = root
        .canonicalize()
        .map_err(|e| format!("无法解析工程路径: {e}"))?;
    app.asset_protocol_scope()
        .allow_directory(&root, true)
        .map_err(|e| format!("注册素材预览访问范围失败: {e}"))
}
