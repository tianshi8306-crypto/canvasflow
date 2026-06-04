//! BGM 混音：将外部音频文件叠加到视频的音频轨道上
//!
//! 使用 FFmpeg filter_complex 实现：
//!   - BGM 独立流循环（-stream_loop）匹配视频时长
//!   - 淡入淡出 + 音量控制
//!   - 原声保留/替换
//!   - 视频流 copy 不重编码

use crate::command_common::resolve_ffmpeg_bin_auto;
use crate::compose_concat::validate_path_inside_project;
use crate::settings;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BgmOverlayOptions {
    /// BGM 音频文件相对路径（工程内）
    pub bgm_rel_path: String,
    /// BGM 音量比例（0.0 ~ 1.0），默认 0.3
    #[serde(default = "default_bgm_volume")]
    pub bgm_volume: f64,
    /// 是否保留原声
    #[serde(default = "default_true")]
    pub keep_original_audio: bool,
    /// 原声音量比例（0.0 ~ 1.0），默认 1.0
    #[serde(default = "default_one")]
    pub original_volume: f64,
    /// 是否自动循环 BGM 以匹配视频时长
    #[serde(default = "default_true")]
    pub loop_bgm: bool,
    /// 淡入时长（秒），默认 1.5
    #[serde(default = "default_fade_in")]
    pub fade_in_sec: f64,
    /// 淡出时长（秒），默认 2.0
    #[serde(default = "default_fade_out")]
    pub fade_out_sec: f64,
    /// 视频时长（秒），用于淡出起点计算
    pub video_duration_sec: f64,
}

fn default_bgm_volume() -> f64 { 0.3 }
fn default_true() -> bool { true }
fn default_one() -> f64 { 1.0 }
fn default_fade_in() -> f64 { 1.5 }
fn default_fade_out() -> f64 { 2.0 }

/// 将 BGM 叠加到视频上，输出到工程内相对路径
#[tauri::command]
pub fn overlay_bgm_to_video(
    app: tauri::AppHandle,
    project_path: String,
    video_rel_path: String,
    output_rel_path: Option<String>,
    options: BgmOverlayOptions,
) -> Result<String, String> {
    let root = PathBuf::from(&project_path);
    let settings = settings::load_settings(&app)?;
    let ffmpeg = resolve_ffmpeg_bin_auto(&app, &settings);

    let video_abs = validate_path_inside_project(&root.join(&video_rel_path), &root)?;
    if !video_abs.is_file() {
        return Err(format!("找不到视频文件：{}", video_rel_path));
    }

    let bgm_abs = validate_path_inside_project(&root.join(&options.bgm_rel_path), &root)?;
    if !bgm_abs.is_file() {
        return Err(format!("找不到 BGM 文件：{}", options.bgm_rel_path));
    }

    let out_rel = output_rel_path
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "assets/exports/final_with_bgm.mp4".into());

    let out_path = root.join(&out_rel);
    if let Some(parent) = out_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let stream_loop = if options.loop_bgm { "-1" } else { "0" };

    let bgm_vol = options.bgm_volume.clamp(0.0, 1.0);
    let orig_vol = if options.keep_original_audio {
        options.original_volume.clamp(0.0, 1.0)
    } else {
        -1.0
    };

    let fade_out_st = (options.video_duration_sec - options.fade_out_sec).max(0.0);

    // 构建 filter_complex
    let mut filter_parts: Vec<String> = Vec::new();

    // BGM 链
    let mut bgm_chain = String::new();
    if options.fade_in_sec > 0.0 {
        bgm_chain.push_str(&format!("afade=t=in:st=0:d={:.2}", options.fade_in_sec));
        bgm_chain.push(',');
    }
    bgm_chain.push_str(&format!("volume={:.3}", bgm_vol));
    filter_parts.push(format!("[1:a]{bgm_chain}[bgm]"));

    // 原声链
    if orig_vol >= 0.0 {
        filter_parts.push(format!("[0:a]volume={:.3}[orig]", orig_vol));
    }

    // 混合
    let mut mix = if orig_vol >= 0.0 {
        String::from("[orig][bgm]amix=inputs=2:duration=first:dropout_transition=0")
    } else {
        String::from("[bgm]anull")
    };

    // 全局淡出
    if options.fade_out_sec > 0.0 {
        mix.push_str(&format!(
            ",afade=t=out:st={:.2}:d={:.2}",
            fade_out_st, options.fade_out_sec
        ));
    }
    mix.push_str("[outa]");
    filter_parts.push(mix);

    let filter_complex = filter_parts.join(";");

    let mut cmd = Command::new(&ffmpeg);
    cmd.args([
        "-y",
        "-i", &video_abs.to_string_lossy(),
        "-stream_loop", stream_loop,
        "-i", &bgm_abs.to_string_lossy(),
        "-filter_complex", &filter_complex,
        "-map", "0:v:0",
        "-map", "[outa]",
        "-c:v", "copy",
        "-c:a", "aac",
        "-shortest",
    ]);
    cmd.arg(&out_path);

    let status = cmd
        .status()
        .map_err(|e| format!("无法启动 ffmpeg（{}）：{}", ffmpeg, e))?;

    if !status.success() {
        return Err(format!("ffmpeg 退出码: {:?}", status.code()));
    }

    Ok(out_path
        .strip_prefix(&root)
        .map(|p| p.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|_| out_rel))
}
