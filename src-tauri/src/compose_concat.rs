//! 工程内多段视频首尾拼接（concat demuxer / 单段 copy）。

use serde::Deserialize;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TimelineEncodeOptions {
    pub resolution: Option<String>,
    pub video_bitrate_kbps: Option<u32>,
    pub fps: Option<String>,
}

impl TimelineEncodeOptions {
    fn needs_reencode(&self) -> bool {
        let res = self.resolution.as_deref().unwrap_or("source");
        let kbps = self.video_bitrate_kbps.unwrap_or(0);
        let fps_not_source = self.fps.as_deref().map_or(false, |f| f != "source");
        res != "source" || kbps > 0 || fps_not_source
    }
}

fn resolution_scale_filter(resolution: &str) -> Option<String> {
    let (w, h) = match resolution {
        "1080p" => (1920, 1080),
        "720p" => (1280, 720),
        "480p" => (854, 480),
        _ => return None,
    };
    Some(format!(
        "scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2"
    ))
}

/// 验证路径在工程根目录下（防路径穿越）
pub fn validate_path_inside_project(
    input_path: &Path,
    project_root: &Path,
) -> Result<PathBuf, String> {
    let abs = input_path
        .canonicalize()
        .map_err(|_| format!("路径无法规范化：{}", input_path.display()))?;
    let root_abs = project_root
        .canonicalize()
        .map_err(|_| format!("工程根目录无法规范化：{}", project_root.display()))?;
    if !abs.starts_with(&root_abs) {
        return Err(format!(
            "禁止访问工程目录之外的文件：{}",
            input_path.display()
        ));
    }
    Ok(abs)
}

fn escape_ffmpeg_input(s: &str) -> String {
    s.replace('\'', "'\\''")
}

fn resolve_profile(output_rel: &str, export_format: Option<&str>) -> &'static str {
    if let Some(fmt) = export_format {
        return match fmt {
            "gif" => "gif",
            "prores" => "prores",
            "webm" => "webm",
            "mov" => "mov",
            _ => "mp4",
        };
    }
    let lower = output_rel.to_lowercase();
    if lower.ends_with(".gif") {
        "gif"
    } else if lower.ends_with(".webm") {
        "webm"
    } else if lower.ends_with(".mov") {
        "mov"
    } else {
        "mp4"
    }
}

fn output_ext(profile: &str) -> &str {
    match profile {
        "gif" => "gif",
        "webm" => "webm",
        "prores" | "mov" => "mov",
        _ => "mp4",
    }
}

fn profile_always_reencodes(profile: &str) -> bool {
    matches!(profile, "gif" | "prores" | "webm")
}

fn build_video_filters(profile: &str, encode: Option<&TimelineEncodeOptions>) -> Option<String> {
    let res = encode
        .and_then(|e| e.resolution.as_deref())
        .unwrap_or("source");
    let fps = encode
        .and_then(|e| e.fps.as_deref())
        .filter(|f| *f != "source");
    let scale = resolution_scale_filter(res);

    let mut parts: Vec<String> = Vec::new();

    if let Some(fps_val) = fps {
        parts.push(format!("fps={fps_val}"));
    }

    match profile {
        "gif" => {
            let scale_expr =
                scale.unwrap_or_else(|| "scale=-2:480:flags=lanczos".to_string());
            parts.push(if !parts.is_empty() {
                scale_expr
            } else {
                scale_expr
            });
            parts.push("split[s0][s1]".into());
            parts.push("[s0]palettegen=stats_mode=diff:max_colors=256[p]".into());
            parts.push("[s1][p]paletteuse=dither=bayer:bayer_scale=3".into());
        }
        _ => {
            if let Some(s) = scale {
                parts.push(s);
            }
        }
    }

    if parts.is_empty() {
        None
    } else {
        Some(parts.join(","))
    }
}

fn append_vf_if_needed(cmd: &mut Command, profile: &str, encode: Option<&TimelineEncodeOptions>) {
    if let Some(vf) = build_video_filters(profile, encode) {
        cmd.args(["-vf", &vf]);
    }
}

fn append_video_encode_args(cmd: &mut Command, profile: &str, bitrate_kbps: Option<u32>) {
    let kbps = bitrate_kbps.filter(|k| *k > 0);
    match profile {
        "gif" => {
            cmd.args(["-an", "-loop", "0", "-c:v", "gif"]);
        }
        "prores" => {
            cmd.args([
                "-c:v",
                "prores_ks",
                "-profile:v",
                "2",
                "-pix_fmt",
                "yuv422p10le",
                "-c:a",
                "pcm_s16le",
                "-f",
                "mov",
            ]);
        }
        "webm" => {
            cmd.arg("-c:v").arg("libvpx-vp9");
            if let Some(k) = kbps {
                cmd.arg("-b:v").arg(format!("{k}k"));
            } else {
                cmd.args(["-crf", "33", "-b:v", "0"]);
            }
            cmd.args(["-c:a", "libopus"]);
        }
        "mov" => {
            cmd.args(["-c:v", "libx264", "-c:a", "aac", "-pix_fmt", "yuv420p"]);
            if let Some(k) = kbps {
                let rate = format!("{k}k");
                let buf = format!("{}k", k * 2);
                cmd.arg("-b:v").arg(&rate).arg("-maxrate").arg(&rate).arg("-bufsize").arg(buf);
            } else {
                cmd.args(["-crf", "23"]);
            }
            cmd.args(["-f", "mov"]);
        }
        _ => {
            cmd.args(["-c:v", "libx264", "-c:a", "aac", "-pix_fmt", "yuv420p"]);
            if let Some(k) = kbps {
                let rate = format!("{k}k");
                let buf = format!("{}k", k * 2);
                cmd.arg("-b:v").arg(&rate).arg("-maxrate").arg(&rate).arg("-bufsize").arg(buf);
            } else {
                cmd.args(["-crf", "23"]);
            }
        }
    }
}

fn can_stream_copy(input_abs: &Path, profile: &str) -> bool {
    let in_ext = input_abs
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    in_ext == output_ext(profile)
}

/// 将工程内相对路径片段拼接为 `output_rel`（相对工程根）。
pub fn compose_concat_clips(
    project_root: &Path,
    ffmpeg_bin: &str,
    input_rels: &[String],
    output_rel: &str,
    encode: Option<TimelineEncodeOptions>,
    export_format: Option<&str>,
) -> Result<String, String> {
    if input_rels.is_empty() {
        return Err("没有可合成的视频片段".into());
    }

    let out_path: PathBuf = project_root.join(output_rel);
    if let Some(parent) = out_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let profile = resolve_profile(output_rel, export_format);
    let encode_ref = encode.as_ref();
    let custom_encode = encode_ref.map(|e| e.needs_reencode()).unwrap_or(false)
        || profile_always_reencodes(profile);
    let bitrate_kbps = if profile == "gif" {
        None
    } else {
        encode_ref.and_then(|e| e.video_bitrate_kbps)
    };

    match input_rels.len() {
        1 => {
            let abs = validate_path_inside_project(&project_root.join(&input_rels[0]), project_root)?;
            if !abs.is_file() {
                return Err(format!("找不到输入文件：{}", abs.display()));
            }
            let mut cmd = Command::new(ffmpeg_bin);
            cmd.args(["-y", "-i", &abs.to_string_lossy()]);
            if !custom_encode && can_stream_copy(&abs, profile) {
                cmd.args(["-c", "copy"]);
            } else {
                append_vf_if_needed(&mut cmd, profile, encode_ref);
                append_video_encode_args(&mut cmd, profile, bitrate_kbps);
            }
            cmd.arg(&out_path);
            let status = cmd
                .status()
                .map_err(|e| format!("无法启动 ffmpeg（{}）：{}", ffmpeg_bin, e))?;
            if !status.success() {
                return Err(format!("ffmpeg 退出码: {:?}", status.code()));
            }
        }
        _ => {
            let dot_dir = project_root.join(".canvasflow");
            std::fs::create_dir_all(&dot_dir).map_err(|e| e.to_string())?;
            let list_path = dot_dir.join("timeline_concat.txt");

            let mut list = String::new();
            for rel in input_rels {
                let abs = validate_path_inside_project(&project_root.join(rel), project_root)?;
                if !abs.is_file() {
                    return Err(format!("找不到输入文件：{}", abs.display()));
                }
                let escaped = escape_ffmpeg_input(&abs.to_string_lossy());
                list.push_str(&format!("file '{}'\n", escaped));
            }
            std::fs::write(&list_path, list).map_err(|e| e.to_string())?;

            let mut cmd = Command::new(ffmpeg_bin);
            cmd.args([
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                &list_path.to_string_lossy(),
            ]);
            append_vf_if_needed(&mut cmd, profile, encode_ref);
            append_video_encode_args(&mut cmd, profile, bitrate_kbps);
            cmd.arg(&out_path);
            let status = cmd
                .status()
                .map_err(|e| format!("无法启动 ffmpeg（{}）：{}", ffmpeg_bin, e))?;
            if !status.success() {
                return Err(format!("ffmpeg 退出码: {:?}", status.code()));
            }
        }
    }

    Ok(out_path
        .strip_prefix(project_root)
        .map(|p| p.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|_| output_rel.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_empty_inputs() {
        let root = std::env::temp_dir();
        let err = compose_concat_clips(&root, "ffmpeg", &[], "out.mp4", None, None).unwrap_err();
        assert!(err.contains("没有可合成"));
    }

    #[test]
    fn resolve_profile_from_path_and_format() {
        assert_eq!(resolve_profile("final.webm", None), "webm");
        assert_eq!(resolve_profile("final.mov", Some("prores")), "prores");
        assert_eq!(resolve_profile("final.mov", None), "mov");
        assert_eq!(resolve_profile("out.gif", None), "gif");
    }

    #[test]
    fn scale_filter_for_720p() {
        let vf = resolution_scale_filter("720p").unwrap();
        assert!(vf.contains("1280:720"));
    }
}
