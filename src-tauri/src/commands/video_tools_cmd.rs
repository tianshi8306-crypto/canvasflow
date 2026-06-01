//! 视频预览顶栏工具：FFmpeg 音轨提取等

use crate::command_common::resolve_ffmpeg_bin_auto;
use crate::db;
use crate::project_asset_store::{self, AssetWriteContext};
use crate::settings;
use std::path::{Path, PathBuf};
use std::process::Command;
fn sanitize_stem(name: &str) -> String {
    let mut s: String = name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();
    if s.is_empty() {
        s = "audio".into();
    }
    if s.len() > 48 {
        s.truncate(48);
    }
    s
}

fn allocate_tool_output(
    root: &Path,
    kind: &str,
    ext: &str,
    tool: &str,
    source_stem: &str,
) -> Result<(String, PathBuf), String> {
    let ctx = AssetWriteContext {
        kind,
        source: "tools",
        workflow: Some(tool),
        node_id: None,
        job_id: Some(source_stem),
    };
    project_asset_store::allocate_project_asset_paths(root, ext, &ctx)
}

fn finalize_tool_output(
    root: &Path,
    out_abs: &Path,
    kind: &str,
    tool: &str,
    source_stem: &str,
) -> Result<db::ImportedMediaItem, String> {
    let ctx = AssetWriteContext {
        kind,
        source: "tools",
        workflow: Some(tool),
        node_id: None,
        job_id: Some(source_stem),
    };
    let rel = project_asset_store::register_asset_at_path(root, out_abs, &ctx)?;
    let conn = db::open_run_db(root)?;
    let asset_id = db::get_asset_by_rel_path(&conn, &rel)?
        .map(|a| a.asset_id)
        .ok_or_else(|| format!("工具输出未登记：{rel}"))?;
    Ok(db::ImportedMediaItem {
        asset_id,
        rel_path: rel,
    })
}

/// 从工程内视频提取音轨到 `assets/gen/audio/tools/`，并登记素材索引
#[tauri::command]
pub fn extract_video_audio_to_assets(
    app: tauri::AppHandle,
    project_path: String,
    video_rel_path: String,
    mode: String,
) -> Result<db::ImportedMediaItem, String> {
    if mode == "bgm" {
        return Err(
            "伴奏分离需要 AI 模型，尚未接入；可先使用「提取人声」导出混合音轨".into(),
        );
    }
    if mode != "vocal" {
        return Err(format!("未知音频分离模式：{}", mode));
    }

    let root = PathBuf::from(&project_path);
    let src = root.join(&video_rel_path);
    if !src.is_file() {
        return Err(format!("视频文件不存在：{}", src.display()));
    }

    let settings = settings::load_settings(&app)?;
    let ffmpeg = resolve_ffmpeg_bin_auto(&app, &settings);

    let stem = src
        .file_stem()
        .and_then(|s| s.to_str())
        .map(sanitize_stem)
        .unwrap_or_else(|| "audio".into());
    let (_rel, out_abs) = allocate_tool_output(&root, "audio", "m4a", "extract", &stem)?;

    let src_esc = escape_ffmpeg_path(&src);
    let out_esc = escape_ffmpeg_path(&out_abs);

    // 先尝试流复制，失败则用 AAC 转码
    let copy_args = vec![
        "-y".to_string(),
        "-i".to_string(),
        src_esc.clone(),
        "-vn".to_string(),
        "-acodec".to_string(),
        "copy".to_string(),
        out_esc.clone(),
    ];
    let copy_ok = run_ffmpeg(&ffmpeg, &copy_args)?;
    if !copy_ok {
        let _ = std::fs::remove_file(&out_abs);
        let aac_args = vec![
            "-y".to_string(),
            "-i".to_string(),
            src_esc,
            "-vn".to_string(),
            "-acodec".to_string(),
            "aac".to_string(),
            "-b:a".to_string(),
            "192k".to_string(),
            out_esc,
        ];
        run_ffmpeg_or_err(&ffmpeg, &aac_args)?;
    }

    if !out_abs.is_file() {
        return Err("音轨提取失败：未生成输出文件".into());
    }
    if out_abs.metadata().map(|m| m.len()).unwrap_or(0) < 64 {
        let _ = std::fs::remove_file(&out_abs);
        return Err("该视频没有可提取的音轨".into());
    }

    finalize_tool_output(&root, &out_abs, "audio", "extract", &stem)
}

/// 按入出点裁剪工程内视频，写入 `assets/gen/video/tools/`
#[tauri::command]
pub fn trim_video_to_assets(
    app: tauri::AppHandle,
    project_path: String,
    video_rel_path: String,
    in_sec: f64,
    out_sec: f64,
) -> Result<db::ImportedMediaItem, String> {
    if !in_sec.is_finite() || !out_sec.is_finite() || out_sec <= in_sec {
        return Err("裁剪区间无效：出点须大于入点".into());
    }
    let span = out_sec - in_sec;
    if span < 0.05 {
        return Err("裁剪片段过短（至少 0.05 秒）".into());
    }

    let root = PathBuf::from(&project_path);
    let src = root.join(&video_rel_path);
    if !src.is_file() {
        return Err(format!("视频文件不存在：{}", src.display()));
    }

    let settings = settings::load_settings(&app)?;
    let ffmpeg = resolve_ffmpeg_bin_auto(&app, &settings);

    let stem = src
        .file_stem()
        .and_then(|s| s.to_str())
        .map(sanitize_stem)
        .unwrap_or_else(|| "video".into());
    let (_rel, out_abs) = allocate_tool_output(&root, "video", "mp4", "trim", &stem)?;

    let src_esc = escape_ffmpeg_path(&src);
    let out_esc = escape_ffmpeg_path(&out_abs);
    let ss = format_ffmpeg_time(in_sec);
    let to = format_ffmpeg_time(out_sec);

    let copy_args = vec![
        "-y".to_string(),
        "-i".to_string(),
        src_esc.clone(),
        "-ss".to_string(),
        ss.clone(),
        "-to".to_string(),
        to.clone(),
        "-c".to_string(),
        "copy".to_string(),
        out_esc.clone(),
    ];
    let copy_ok = run_ffmpeg(&ffmpeg, &copy_args)?;
    if !copy_ok {
        let _ = std::fs::remove_file(&out_abs);
        let encode_args = vec![
            "-y".to_string(),
            "-i".to_string(),
            src_esc,
            "-ss".to_string(),
            ss,
            "-to".to_string(),
            to,
            "-c:v".to_string(),
            "libx264".to_string(),
            "-preset".to_string(),
            "fast".to_string(),
            "-crf".to_string(),
            "20".to_string(),
            "-c:a".to_string(),
            "aac".to_string(),
            "-b:a".to_string(),
            "192k".to_string(),
            out_esc,
        ];
        run_ffmpeg_or_err(&ffmpeg, &encode_args)?;
    }

    if !out_abs.is_file() {
        return Err("裁剪失败：未生成输出文件".into());
    }
    if out_abs.metadata().map(|m| m.len()).unwrap_or(0) < 256 {
        let _ = std::fs::remove_file(&out_abs);
        return Err("裁剪失败：输出文件过小".into());
    }

    finalize_tool_output(&root, &out_abs, "video", "trim", &stem)
}

/// 按归一化矩形对工程内视频去字幕（delogo），写入 `assets/gen/video/tools/`
#[tauri::command]
pub fn delogo_video_to_assets(
    app: tauri::AppHandle,
    project_path: String,
    video_rel_path: String,
    region_x: f64,
    region_y: f64,
    region_w: f64,
    region_h: f64,
    source_width: u32,
    source_height: u32,
) -> Result<db::ImportedMediaItem, String> {
    if source_width < 8 || source_height < 8 {
        return Err("视频尺寸未知，请等待预览加载完成后再试".into());
    }
    if !region_x.is_finite()
        || !region_y.is_finite()
        || !region_w.is_finite()
        || !region_h.is_finite()
    {
        return Err("框选区域无效".into());
    }
    if region_w <= 0.0 || region_h <= 0.0 {
        return Err("框选区域过小".into());
    }

    let (x, y, w, h) = delogo_pixels(
        region_x,
        region_y,
        region_w,
        region_h,
        source_width,
        source_height,
    )?;

    let root = PathBuf::from(&project_path);
    let src = root.join(&video_rel_path);
    if !src.is_file() {
        return Err(format!("视频文件不存在：{}", src.display()));
    }

    let settings = settings::load_settings(&app)?;
    let ffmpeg = resolve_ffmpeg_bin_auto(&app, &settings);

    let stem = src
        .file_stem()
        .and_then(|s| s.to_str())
        .map(sanitize_stem)
        .unwrap_or_else(|| "video".into());
    let (_rel, out_abs) = allocate_tool_output(&root, "video", "mp4", "delogo", &stem)?;

    let src_esc = escape_ffmpeg_path(&src);
    let out_esc = escape_ffmpeg_path(&out_abs);
    let vf = format!("delogo=x={}:y={}:w={}:h={}", x, y, w, h);

    let encode_args = vec![
        "-y".to_string(),
        "-i".to_string(),
        src_esc,
        "-vf".to_string(),
        vf,
        "-c:v".to_string(),
        "libx264".to_string(),
        "-preset".to_string(),
        "fast".to_string(),
        "-crf".to_string(),
        "20".to_string(),
        "-c:a".to_string(),
        "copy".to_string(),
        out_esc,
    ];
    run_ffmpeg_delogo_or_err(&ffmpeg, &encode_args)?;

    if !out_abs.is_file() {
        return Err("去字幕失败：未生成输出文件".into());
    }
    if out_abs.metadata().map(|m| m.len()).unwrap_or(0) < 256 {
        let _ = std::fs::remove_file(&out_abs);
        return Err("去字幕失败：输出文件过小".into());
    }

    finalize_tool_output(&root, &out_abs, "video", "delogo", &stem)
}

fn delogo_pixels(
    rx: f64,
    ry: f64,
    rw: f64,
    rh: f64,
    src_w: u32,
    src_h: u32,
) -> Result<(i32, i32, i32, i32), String> {
    let sw = src_w as f64;
    let sh = src_h as f64;
    let mut x = (rx.clamp(0.0, 1.0) * sw).round() as i32;
    let mut y = (ry.clamp(0.0, 1.0) * sh).round() as i32;
    let mut w = (rw.clamp(0.0, 1.0) * sw).round() as i32;
    let mut h = (rh.clamp(0.0, 1.0) * sh).round() as i32;

    w = w.max(4);
    h = h.max(4);
    if x + w > src_w as i32 {
        x = (src_w as i32 - w).max(0);
    }
    if y + h > src_h as i32 {
        y = (src_h as i32 - h).max(0);
    }
    if x < 0 {
        x = 0;
    }
    if y < 0 {
        y = 0;
    }

    x = to_even(x);
    y = to_even(y);
    w = to_even(w.max(4));
    h = to_even(h.max(4));
    if x + w > src_w as i32 {
        w = to_even((src_w as i32 - x).max(4));
    }
    if y + h > src_h as i32 {
        h = to_even((src_h as i32 - y).max(4));
    }

    if w < 4 || h < 4 {
        return Err("框选区域过小，请放大选区".into());
    }
    Ok((x, y, w, h))
}

fn to_even(n: i32) -> i32 {
    let v = n.max(0);
    if v % 2 == 0 {
        v
    } else {
        v - 1
    }
}

fn format_ffmpeg_time(sec: f64) -> String {
    format!("{:.3}", sec.max(0.0))
}

fn escape_ffmpeg_path(p: &Path) -> String {
    let s = p.to_string_lossy();
    if s.contains(' ') || s.contains('"') {
        format!("\"{}\"", s.replace('"', "\\\""))
    } else {
        s.into_owned()
    }
}

fn run_ffmpeg(ffmpeg: &str, args: &[String]) -> Result<bool, String> {
    let status = Command::new(ffmpeg)
        .args(args)
        .output()
        .map_err(|e| format!("无法启动 ffmpeg（{}）：{}", ffmpeg, e))?;
    Ok(status.status.success())
}

fn run_ffmpeg_or_err(ffmpeg: &str, args: &[String]) -> Result<(), String> {
    if run_ffmpeg(ffmpeg, args)? {
        Ok(())
    } else {
        Err("ffmpeg 音轨提取失败，请确认已安装 ffmpeg 且视频含音轨".into())
    }
}

fn run_ffmpeg_delogo_or_err(ffmpeg: &str, args: &[String]) -> Result<(), String> {
    if run_ffmpeg(ffmpeg, args)? {
        Ok(())
    } else {
        Err("ffmpeg 去字幕失败，请确认已安装 ffmpeg 且框选区域有效".into())
    }
}
