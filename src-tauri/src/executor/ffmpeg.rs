use crate::command_common::resolve_ffmpeg_bin;
use crate::db;
use crate::graph::FlowNode;
use crate::settings::AppSettings;
use rusqlite::Connection;
use serde_json::json;
use std::path::{Path, PathBuf};
use std::process::Command;

pub(crate) fn run_ffmpeg_concat(
    project_root: &Path,
    node: &FlowNode,
    settings: &AppSettings,
    conn: &mut Connection,
    run_id: &str,
) -> Result<String, String> {
    let ffmpeg = resolve_ffmpeg_bin(settings);
    let inputs: Vec<String> = node
        .data
        .get("inputs")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|x| x.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();

    let output_rel = node
        .data
        .get("output")
        .and_then(|v| v.as_str())
        .unwrap_or("output/render.mp4");

    let out_path: PathBuf = project_root.join(output_rel);
    if let Some(parent) = out_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    if inputs.is_empty() {
        return Err("FFmpeg 节点：inputs 为空".into());
    }

    let dot_dir = project_root.join(".canvasflow");
    std::fs::create_dir_all(&dot_dir).map_err(|e| e.to_string())?;
    let list_path = dot_dir.join(format!(
        "concat_{}.txt",
        node.id.replace(['/', '\\', ':'], "_")
    ));

    let mut list = String::new();
    for p in &inputs {
        let abs = project_root.join(p);
        if !abs.exists() {
            return Err(format!("找不到输入文件：{}", abs.display()));
        }
        let s = abs.to_string_lossy().replace('\\', "/");
        list.push_str(&format!("file '{}'\n", s));
    }
    std::fs::write(&list_path, list).map_err(|e| e.to_string())?;

    let args: Vec<String> = vec![
        "-y".into(),
        "-f".into(),
        "concat".into(),
        "-safe".into(),
        "0".into(),
        "-i".into(),
        list_path.to_string_lossy().to_string(),
        "-c:v".into(),
        "libx264".into(),
        "-c:a".into(),
        "aac".into(),
        "-pix_fmt".into(),
        "yuv420p".into(),
        out_path.to_string_lossy().to_string(),
    ];

    db::log_event(
        conn,
        run_id,
        Some(&node.id),
        "ffmpeg_invocation",
        &json!({ "ffmpeg": ffmpeg, "args": args }),
    )?;

    let status = Command::new(&ffmpeg)
        .args(&args)
        .status()
        .map_err(|e| format!("无法启动 ffmpeg（{}）：{}", ffmpeg, e))?;

    if !status.success() {
        return Err(format!("ffmpeg 退出码: {:?}", status.code()));
    }

    let rel = out_path
        .strip_prefix(project_root)
        .map(|p| p.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|_| output_rel.to_string());

    db::log_event(
        conn,
        run_id,
        Some(&node.id),
        "ffmpeg_done",
        &json!({ "output": rel }),
    )?;

    Ok(rel)
}
