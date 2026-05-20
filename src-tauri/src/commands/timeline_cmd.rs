use crate::command_common::resolve_ffmpeg_bin_auto;
use crate::compose_concat::compose_concat_clips;
use crate::settings;
use std::path::PathBuf;

#[tauri::command]
pub fn render_timeline(
    app: tauri::AppHandle,
    project_path: String,
    clips: Vec<String>,
    output_rel_path: Option<String>,
) -> Result<String, String> {
    let root = PathBuf::from(&project_path);
    let out_rel = output_rel_path
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "assets/exports/final.mp4".into());

    let settings = settings::load_settings(&app)?;
    let ffmpeg = resolve_ffmpeg_bin_auto(&app, &settings);
    compose_concat_clips(&root, &ffmpeg, &clips, &out_rel)
}
