//! 工程内多段视频首尾拼接（concat demuxer / 单段 copy）。

use std::path::{Path, PathBuf};
use std::process::Command;

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

/// 将工程内相对路径片段拼接为 `output_rel`（相对工程根）。
pub fn compose_concat_clips(
    project_root: &Path,
    ffmpeg_bin: &str,
    input_rels: &[String],
    output_rel: &str,
) -> Result<String, String> {
    if input_rels.is_empty() {
        return Err("没有可合成的视频片段".into());
    }

    let out_path: PathBuf = project_root.join(output_rel);
    if let Some(parent) = out_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    match input_rels.len() {
        1 => {
            let abs = validate_path_inside_project(&project_root.join(&input_rels[0]), project_root)?;
            if !abs.is_file() {
                return Err(format!("找不到输入文件：{}", abs.display()));
            }
            let status = Command::new(ffmpeg_bin)
                .args([
                    "-y",
                    "-i",
                    &abs.to_string_lossy(),
                    "-c",
                    "copy",
                    &out_path.to_string_lossy(),
                ])
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

            let status = Command::new(ffmpeg_bin)
                .args([
                    "-y",
                    "-f",
                    "concat",
                    "-safe",
                    "0",
                    "-i",
                    &list_path.to_string_lossy(),
                    "-c:v",
                    "libx264",
                    "-c:a",
                    "aac",
                    "-pix_fmt",
                    "yuv420p",
                    &out_path.to_string_lossy(),
                ])
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
        let err = compose_concat_clips(&root, "ffmpeg", &[], "out.mp4").unwrap_err();
        assert!(err.contains("没有可合成"));
    }
}
