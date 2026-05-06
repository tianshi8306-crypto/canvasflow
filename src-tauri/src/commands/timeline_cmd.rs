use crate::command_common::resolve_ffmpeg_bin_auto;
use crate::settings;
use std::path::PathBuf;
use std::process::Command;

#[tauri::command]
pub fn render_timeline(
    app: tauri::AppHandle,
    project_path: String,
    clips: Vec<String>,
    output_rel_path: Option<String>,
) -> Result<String, String> {
    if clips.len() < 2 {
        return Err("至少需要两个片段进行拼接".into());
    }
    let root = PathBuf::from(&project_path);
    let out_rel = output_rel_path.unwrap_or_else(|| "assets/exports/final.mp4".into());
    let out = root.join(&out_rel);
    if let Some(parent) = out.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let list = root.join(".canvasflow").join("timeline_concat.txt");
    let mut body = String::new();
    for clip in clips {
        let p = root.join(&clip);
        if !p.exists() {
            return Err(format!("找不到片段：{}", clip));
        }
        body.push_str(&format!("file '{}'\n", p.to_string_lossy().replace('\\', "/")));
    }
    std::fs::write(&list, body).map_err(|e| e.to_string())?;

    let settings = settings::load_settings(&app)?;
    let ffmpeg = resolve_ffmpeg_bin_auto(&app, &settings);
    let status = Command::new(&ffmpeg)
        .args([
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            &list.to_string_lossy(),
            "-c:v",
            "libx264",
            "-c:a",
            "aac",
            "-pix_fmt",
            "yuv420p",
            &out.to_string_lossy(),
        ])
        .status()
        .map_err(|e| format!("执行 ffmpeg 失败（{}）：{}", ffmpeg, e))?;
    if !status.success() {
        return Err(format!("ffmpeg 退出码 {:?}", status.code()));
    }
    Ok(out_rel)
}
