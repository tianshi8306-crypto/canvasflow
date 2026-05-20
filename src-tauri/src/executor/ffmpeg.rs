use crate::command_common::resolve_ffmpeg_bin;
use crate::compose_concat::compose_concat_clips;
use crate::db;
use crate::graph::FlowNode;
use crate::settings::AppSettings;
use rusqlite::Connection;
use serde_json::json;
use std::path::Path;

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
        .filter(|s| !s.trim().is_empty())
        .unwrap_or("assets/exports/final.mp4");

    db::log_event(
        conn,
        run_id,
        Some(&node.id),
        "ffmpeg_invocation",
        &json!({ "ffmpeg": ffmpeg, "inputs": inputs, "output": output_rel }),
    )?;

    let rel = compose_concat_clips(project_root, &ffmpeg, &inputs, output_rel)?;

    db::log_event(
        conn,
        run_id,
        Some(&node.id),
        "ffmpeg_done",
        &json!({ "output": rel }),
    )?;

    Ok(rel)
}
