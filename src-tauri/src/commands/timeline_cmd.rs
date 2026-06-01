use crate::command_common::resolve_ffmpeg_bin_auto;
use crate::compose_concat::{compose_concat_clips, TimelineEncodeOptions};
use crate::settings;
use crate::timeline_trim::{resolve_timeline_clip_paths, TimelineRenderClip};
use std::path::PathBuf;

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
