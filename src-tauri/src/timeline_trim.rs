//! 时间线片段裁切：导出前将 in/out 应用到工程内素材。

use crate::compose_concat::validate_path_inside_project;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineRenderClip {
    pub rel_path: String,
    #[serde(default)]
    pub in_sec: f64,
    pub out_sec: Option<f64>,
}

pub fn needs_trim(clip: &TimelineRenderClip) -> bool {
    clip.in_sec > 0.001 || clip.out_sec.is_some()
}

fn format_ffmpeg_time(sec: f64) -> String {
    format!("{:.3}", sec.max(0.0))
}

fn escape_ffmpeg_path(p: &Path) -> String {
    let s = p.to_string_lossy();
    if cfg!(windows) {
        s.replace('\\', "/")
    } else {
        s.to_string()
    }
}

fn run_ffmpeg(ffmpeg: &str, args: &[String]) -> Result<(), String> {
    let status = Command::new(ffmpeg)
        .args(args)
        .status()
        .map_err(|e| format!("无法启动 ffmpeg（{}）：{}", ffmpeg, e))?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("ffmpeg 退出码: {:?}", status.code()))
    }
}

/// 将单段裁切写入工程 `.canvasflow/timeline-trim/` 临时文件，返回相对路径。
pub fn trim_clip_to_temp(
    project_root: &Path,
    ffmpeg_bin: &str,
    rel_path: &str,
    in_sec: f64,
    out_sec: Option<f64>,
    index: usize,
) -> Result<String, String> {
    if !in_sec.is_finite() || in_sec < 0.0 {
        return Err("入点无效".into());
    }
    if let Some(out) = out_sec {
        if !out.is_finite() || out <= in_sec + 0.05 {
            return Err("出点须大于入点至少 0.05 秒".into());
        }
    }

    let src_abs = validate_path_inside_project(&project_root.join(rel_path), project_root)?;
    if !src_abs.is_file() {
        return Err(format!("找不到输入文件：{}", src_abs.display()));
    }

    let trim_dir = project_root.join(".canvasflow/timeline-trim");
    std::fs::create_dir_all(&trim_dir).map_err(|e| e.to_string())?;
    let out_name = format!(
        "seg-{}-{}.mp4",
        index,
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0)
    );
    let out_abs = trim_dir.join(&out_name);
    let out_rel = format!(".canvasflow/timeline-trim/{}", out_name);

    let src_esc = escape_ffmpeg_path(&src_abs);
    let out_esc = escape_ffmpeg_path(&out_abs);
    let ss = format_ffmpeg_time(in_sec);

    let mut args = vec![
        "-y".to_string(),
        "-i".to_string(),
        src_esc.clone(),
        "-ss".to_string(),
        ss,
    ];
    if let Some(out) = out_sec {
        args.push("-to".to_string());
        args.push(format_ffmpeg_time(out));
    }
    args.extend([
        "-c".to_string(),
        "copy".to_string(),
        out_esc.clone(),
    ]);

    if run_ffmpeg(ffmpeg_bin, &args).is_err() {
        let _ = std::fs::remove_file(&out_abs);
        let mut enc = vec![
            "-y".to_string(),
            "-i".to_string(),
            src_esc,
            "-ss".to_string(),
            format_ffmpeg_time(in_sec),
        ];
        if let Some(out) = out_sec {
            enc.push("-to".to_string());
            enc.push(format_ffmpeg_time(out));
        }
        enc.extend([
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
        ]);
        run_ffmpeg(ffmpeg_bin, &enc)?;
    }

    if !out_abs.is_file() || out_abs.metadata().map(|m| m.len()).unwrap_or(0) < 256 {
        let _ = std::fs::remove_file(&out_abs);
        return Err("裁切失败：未生成有效输出".into());
    }

    Ok(out_rel)
}

/// 解析时间线条目为可拼接的相对路径列表（必要时先裁切）。
pub fn resolve_timeline_clip_paths(
    project_root: &Path,
    ffmpeg_bin: &str,
    clips: &[TimelineRenderClip],
) -> Result<Vec<String>, String> {
    let mut out = Vec::with_capacity(clips.len());
    for (i, clip) in clips.iter().enumerate() {
        let rel = clip.rel_path.trim();
        if rel.is_empty() {
            return Err("片段路径为空".into());
        }
        if needs_trim(clip) {
            let trimmed = trim_clip_to_temp(
                project_root,
                ffmpeg_bin,
                rel,
                clip.in_sec,
                clip.out_sec,
                i,
            )?;
            out.push(trimmed);
        } else {
            validate_path_inside_project(&project_root.join(rel), project_root)?;
            out.push(rel.to_string());
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn needs_trim_detects_in_and_out() {
        assert!(!needs_trim(&TimelineRenderClip {
            rel_path: "a.mp4".into(),
            in_sec: 0.0,
            out_sec: None,
        }));
        assert!(needs_trim(&TimelineRenderClip {
            rel_path: "a.mp4".into(),
            in_sec: 1.0,
            out_sec: None,
        }));
        assert!(needs_trim(&TimelineRenderClip {
            rel_path: "a.mp4".into(),
            in_sec: 0.0,
            out_sec: Some(5.0),
        }));
    }
}
