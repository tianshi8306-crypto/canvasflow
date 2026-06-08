use crate::command_common::resolve_ffmpeg_bin_auto;
use crate::compose_concat::{compose_concat_clips, TimelineEncodeOptions};
use crate::settings;
use crate::timeline_trim::{resolve_timeline_clip_paths, TimelineRenderClip};
use std::path::PathBuf;
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub fn render_timeline(
    app: tauri::AppHandle,
    project_path: String,
    clips: Vec<TimelineRenderClip>,
    output_rel_path: Option<String>,
    encode_options: Option<TimelineEncodeOptions>,
    export_format: Option<String>,
) -> Result<String, String> {
    if clips.is_empty() {
        return Err("没有可导出的视频片段".into());
    }

    let root = PathBuf::from(&project_path);
    let out_rel = output_rel_path
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "assets/exports/final.mp4".into());

    let settings = settings::load_settings(&app)?;
    let ffmpeg = resolve_ffmpeg_bin_auto(&app, &settings);

    let resolved = resolve_timeline_clip_paths(&root, &ffmpeg, &clips)?;
    compose_concat_clips(
        &root,
        &ffmpeg,
        &resolved,
        &out_rel,
        encode_options,
        export_format.as_deref(),
    )
}

/// 弹出系统保存对话框，让用户选择导出路径，然后 FFmpeg 合成到该绝对路径。
/// 返回所选绝对路径，失败时返回错误描述。
#[tauri::command]
pub async fn render_timeline_to_path(
    app: tauri::AppHandle,
    project_path: String,
    clips: Vec<TimelineRenderClip>,
    default_name: Option<String>,
    encode_options: Option<TimelineEncodeOptions>,
    export_format: Option<String>,
) -> Result<String, String> {
    if clips.is_empty() {
        return Err("没有可导出的视频片段".into());
    }

    let default = default_name
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "final.mp4".into());

    let chosen = app
        .dialog()
        .file()
        .add_filter("视频文件", &["mp4", "mov", "webm", "gif"])
        .add_filter("所有文件", &["*"])
        .set_file_name(&default)
        .blocking_save_file();

    let Some(dest) = chosen else {
        return Err("已取消导出".into());
    };
    let dest_path = dest.to_string();

    let root = PathBuf::from(&project_path);
    let settings = settings::load_settings(&app)?;
    let ffmpeg = resolve_ffmpeg_bin_auto(&app, &settings);

    let resolved = resolve_timeline_clip_paths(&root, &ffmpeg, &clips)?;

    // 先合成到工程内临时文件，再复制到用户指定路径
    let dest_abs = PathBuf::from(&dest_path);
    let ext = dest_abs
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("mp4");
    let temp_rel = format!(
        "assets/exports/__save_dialog_{}.{}",
        uuid::Uuid::new_v4(),
        ext
    );

    compose_concat_clips(
        &root,
        &ffmpeg,
        &resolved,
        &temp_rel,
        encode_options,
        export_format.as_deref(),
    )?;

    let temp_abs = root.join(&temp_rel);
    let dest_abs = PathBuf::from(&dest_path);

    if let Err(e) = std::fs::copy(&temp_abs, &dest_abs) {
        let _ = std::fs::remove_file(&temp_abs);
        return Err(format!("导出到目标路径失败：{e}"));
    }
    let _ = std::fs::remove_file(&temp_abs);

    Ok(dest_path)
}

/// 在系统文件管理器中打开指定文件/目录。
#[tauri::command]
pub fn reveal_in_shell(path: String) -> Result<(), String> {
    let p = path.trim();
    if p.is_empty() {
        return Err("路径为空".into());
    }
    // 如果是相对路径，先尝试用工程内路径
    let abs = std::path::absolute(PathBuf::from(p))
        .unwrap_or_else(|_| PathBuf::from(p));

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg("/select,")
            .arg(abs.to_string_lossy().as_ref())
            .spawn()
            .map_err(|e| format!("打开文件管理器失败：{e}"))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(abs.to_string_lossy().as_ref())
            .spawn()
            .map_err(|e| format!("打开 Finder 失败：{e}"))?;
    }
    #[cfg(target_os = "linux")]
    {
        // Linux: 尝试打开文件所在目录
        if let Some(parent) = abs.parent() {
            std::process::Command::new("xdg-open")
                .arg(parent)
                .spawn()
                .map_err(|e| format!("打开文件管理器失败：{e}"))?;
        }
    }

    Ok(())
}
