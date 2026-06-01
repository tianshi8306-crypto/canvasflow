//! 画布媒体节点与脚本分镜资产引用对齐（M2 path→id / M3 脚本镜 / M4 id→path 真源）。

use crate::command_common::media_type_from_ext;
use crate::db;
use crate::graph::FlowNode;
use serde_json::{json, Value};
use std::path::Path;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeAssetIdPatch {
    pub node_id: String,
    pub asset_id: String,
    pub rel_path: String,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptNodeAssetPatch {
    pub script_node_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub storyboard_shots: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub script_beats: Option<Value>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasAssetBackfillResult {
    pub node_patches: Vec<NodeAssetIdPatch>,
    pub script_patches: Vec<ScriptNodeAssetPatch>,
}

const MEDIA_NODE_TYPES: &[&str] = &[
    "imageNode",
    "imageAsset",
    "videoNode",
    "audioNode",
    "mediaImport",
];

fn is_media_carrier(node_type: &str) -> bool {
    MEDIA_NODE_TYPES.contains(&node_type)
}

fn media_type_for_node(node_type: &str, rel_path: &str) -> &'static str {
    match node_type {
        "imageNode" | "imageAsset" => "image",
        "videoNode" => "video",
        "audioNode" => "audio",
        _ => {
            let ext = Path::new(rel_path)
                .extension()
                .and_then(|x| x.to_str())
                .unwrap_or("")
                .to_ascii_lowercase();
            media_type_from_ext(&ext)
        }
    }
}

fn canonical_rel_path(conn: &rusqlite::Connection, asset_id: &str) -> Result<Option<String>, String> {
    let row = db::get_asset_by_id(conn, asset_id)?;
    let Some(row) = row else {
        return Ok(None);
    };
    let rel = row.rel_path.trim();
    if rel.is_empty() {
        Ok(None)
    } else {
        Ok(Some(rel.to_string()))
    }
}

/// M4：已有 `assetId` 时以索引中的 `rel_path` 为准，纠正缺失或过期的 `path`。
fn media_path_needs_reconcile(
    conn: &rusqlite::Connection,
    project_root: &Path,
    data: &serde_json::Value,
) -> Result<Option<(String, String)>, String> {
    let asset_id = data
        .get("assetId")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty());
    let Some(asset_id) = asset_id else {
        return Ok(None);
    };
    let Some(canonical) = canonical_rel_path(conn, asset_id)? else {
        return Ok(None);
    };
    if !project_root.join(&canonical).is_file() {
        return Ok(None);
    }
    let current = data
        .get("path")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .unwrap_or("");
    if current == canonical.as_str() {
        return Ok(None);
    }
    Ok(Some((asset_id.to_string(), canonical)))
}

/// 媒体节点双向对齐：`path`→`assetId`（M2）与 `assetId`→`path`（M4）。
pub fn reconcile_graph_media_nodes(
    project_root: &Path,
    nodes: &[FlowNode],
) -> Result<Vec<NodeAssetIdPatch>, String> {
    let conn = db::open_run_db(project_root)?;
    let mut patches = Vec::new();

    for node in nodes {
        if !is_media_carrier(&node.node_type) {
            continue;
        }
        let has_asset_id = node
            .data
            .get("assetId")
            .and_then(|v| v.as_str())
            .map(|s| !s.trim().is_empty())
            .unwrap_or(false);

        if has_asset_id {
            if let Some((asset_id, rel_path)) =
                media_path_needs_reconcile(&conn, project_root, &node.data)?
            {
                patches.push(NodeAssetIdPatch {
                    node_id: node.id.clone(),
                    asset_id,
                    rel_path,
                });
            }
            continue;
        }

        let rel = node
            .data
            .get("path")
            .and_then(|v| v.as_str())
            .map(str::trim)
            .unwrap_or("");
        if rel.is_empty() {
            continue;
        }
        let abs = project_root.join(rel);
        if !abs.is_file() {
            continue;
        }

        let media_type = media_type_for_node(&node.node_type, rel);
        let asset_id = db::upsert_asset(&conn, rel, media_type, Some("backfill"), None)?;
        patches.push(NodeAssetIdPatch {
            node_id: node.id.clone(),
            asset_id,
            rel_path: rel.to_string(),
        });
    }

    Ok(patches)
}

fn upsert_image_asset(conn: &rusqlite::Connection, project_root: &Path, rel: &str) -> Result<String, String> {
    let abs = project_root.join(rel);
    if !abs.is_file() {
        return Err(format!("文件不存在: {}", rel));
    }
    db::upsert_asset(conn, rel, "image", Some("backfill"), None)
}

fn reconcile_image_path_from_asset_id(
    conn: &rusqlite::Connection,
    project_root: &Path,
    obj: &mut serde_json::Map<String, Value>,
    path_key: &str,
    asset_key: &str,
) -> Result<bool, String> {
    let asset_id = obj
        .get(asset_key)
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty());
    let Some(asset_id) = asset_id else {
        return Ok(false);
    };
    let Some(canonical) = canonical_rel_path(conn, asset_id)? else {
        return Ok(false);
    };
    if !project_root.join(&canonical).is_file() {
        return Ok(false);
    }
    let current = obj
        .get(path_key)
        .and_then(|v| v.as_str())
        .map(str::trim)
        .unwrap_or("");
    if current == canonical.as_str() {
        return Ok(false);
    }
    obj.insert(path_key.to_string(), json!(canonical));
    Ok(true)
}

fn backfill_image_path_field(
    conn: &rusqlite::Connection,
    project_root: &Path,
    obj: &mut serde_json::Map<String, Value>,
    path_key: &str,
    asset_key: &str,
) -> Result<bool, String> {
    let rel = obj
        .get(path_key)
        .and_then(|v| v.as_str())
        .map(str::trim)
        .unwrap_or("");
    if rel.is_empty() {
        return Ok(false);
    }
    let has_id = obj
        .get(asset_key)
        .and_then(|v| v.as_str())
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);
    if has_id {
        return Ok(false);
    }
    let asset_id = upsert_image_asset(conn, project_root, rel)?;
    obj.insert(asset_key.to_string(), json!(asset_id));
    Ok(true)
}

fn reconcile_image_fields_in_object(
    conn: &rusqlite::Connection,
    project_root: &Path,
    obj: &mut serde_json::Map<String, Value>,
    path_key: &str,
    asset_key: &str,
) -> Result<bool, String> {
    let mut changed = false;
    if backfill_image_path_field(conn, project_root, obj, path_key, asset_key)? {
        changed = true;
    }
    if reconcile_image_path_from_asset_id(conn, project_root, obj, path_key, asset_key)? {
        changed = true;
    }
    Ok(changed)
}

fn backfill_script_beats_array(
    conn: &rusqlite::Connection,
    project_root: &Path,
    beats: &mut [Value],
) -> Result<bool, String> {
    let mut changed = false;
    for beat in beats.iter_mut() {
        let Some(obj) = beat.as_object_mut() else {
            continue;
        };
        if reconcile_image_fields_in_object(
            conn,
            project_root,
            obj,
            "character1Image",
            "character1ImageAssetId",
        )? {
            changed = true;
        }
        if reconcile_image_fields_in_object(
            conn,
            project_root,
            obj,
            "character2Image",
            "character2ImageAssetId",
        )? {
            changed = true;
        }
        if let Some(chars) = obj.get_mut("characters").and_then(|v| v.as_array_mut()) {
            for ch in chars.iter_mut() {
                let Some(ch_obj) = ch.as_object_mut() else {
                    continue;
                };
                if reconcile_image_fields_in_object(conn, project_root, ch_obj, "imagePath", "imageAssetId")? {
                    changed = true;
                }
            }
        }
    }
    Ok(changed)
}

fn backfill_storyboard_shots_array(
    conn: &rusqlite::Connection,
    project_root: &Path,
    shots: &mut [Value],
) -> Result<bool, String> {
    let mut changed = false;
    for shot in shots.iter_mut() {
        let Some(obj) = shot.as_object_mut() else {
            continue;
        };
        if reconcile_image_fields_in_object(conn, project_root, obj, "imagePath", "imageAssetId")? {
            changed = true;
        }
    }
    Ok(changed)
}

/// 脚本节点：`storyboardShots` / `scriptBeats` 图片字段双向对齐（path↔assetId）。
pub fn backfill_script_asset_ids(
    project_root: &Path,
    nodes: &[FlowNode],
) -> Result<Vec<ScriptNodeAssetPatch>, String> {
    let conn = db::open_run_db(project_root)?;
    let mut patches = Vec::new();

    for node in nodes {
        if node.node_type != "scriptNode" {
            continue;
        }
        let mut shots_changed = false;
        let mut beats_changed = false;
        let mut shots_value = node.data.get("storyboardShots").cloned();
        let mut beats_value = node.data.get("scriptBeats").cloned();

        if let Some(Value::Array(ref mut shots)) = shots_value {
            shots_changed = backfill_storyboard_shots_array(&conn, project_root, shots)?;
        }
        if let Some(Value::Array(ref mut beats)) = beats_value {
            beats_changed = backfill_script_beats_array(&conn, project_root, beats)?;
        }

        if !shots_changed && !beats_changed {
            continue;
        }
        patches.push(ScriptNodeAssetPatch {
            script_node_id: node.id.clone(),
            storyboard_shots: if shots_changed { shots_value } else { None },
            script_beats: if beats_changed { beats_value } else { None },
        });
    }

    Ok(patches)
}

/// 节点媒体 + 脚本镜字段一次性回填。
pub fn backfill_canvas_assets(
    project_root: &Path,
    nodes: &[FlowNode],
) -> Result<CanvasAssetBackfillResult, String> {
    Ok(CanvasAssetBackfillResult {
        node_patches: reconcile_graph_media_nodes(project_root, nodes)?,
        script_patches: backfill_script_asset_ids(project_root, nodes)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::graph::FlowNode;
    use serde_json::json;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn backfill_skips_when_asset_id_present() {
        let dir = tempdir().unwrap();
        let rel = "assets/a.png";
        fs::create_dir_all(dir.path().join("assets")).unwrap();
        fs::write(dir.path().join(rel), b"x").unwrap();
        let conn = db::open_run_db(dir.path()).unwrap();
        let existing = db::upsert_asset(&conn, rel, "image", None, None).unwrap();

        let nodes = vec![FlowNode {
            id: "n1".into(),
            node_type: "imageNode".into(),
            data: json!({ "path": rel, "assetId": existing }),
        }];
        let patches = reconcile_graph_media_nodes(dir.path(), &nodes).unwrap();
        assert!(patches.is_empty());
    }

    #[test]
    fn reconcile_stale_path_from_asset_id() {
        let dir = tempdir().unwrap();
        let rel = "assets/canonical.png";
        let stale = "assets/stale.png";
        fs::create_dir_all(dir.path().join("assets")).unwrap();
        fs::write(dir.path().join(rel), b"x").unwrap();

        let conn = db::open_run_db(dir.path()).unwrap();
        let aid = db::upsert_asset(&conn, rel, "image", None, None).unwrap();

        let nodes = vec![FlowNode {
            id: "n1".into(),
            node_type: "imageNode".into(),
            data: json!({ "path": stale, "assetId": aid }),
        }];
        let patches = reconcile_graph_media_nodes(dir.path(), &nodes).unwrap();
        assert_eq!(patches.len(), 1);
        assert_eq!(patches[0].rel_path, rel);
        assert_eq!(patches[0].asset_id, aid);
    }

    #[test]
    fn reconcile_asset_id_only_fills_path() {
        let dir = tempdir().unwrap();
        let rel = "assets/id-only.png";
        fs::create_dir_all(dir.path().join("assets")).unwrap();
        fs::write(dir.path().join(rel), b"x").unwrap();

        let conn = db::open_run_db(dir.path()).unwrap();
        let aid = db::upsert_asset(&conn, rel, "image", None, None).unwrap();

        let nodes = vec![FlowNode {
            id: "n2".into(),
            node_type: "imageNode".into(),
            data: json!({ "assetId": aid }),
        }];
        let patches = reconcile_graph_media_nodes(dir.path(), &nodes).unwrap();
        assert_eq!(patches.len(), 1);
        assert_eq!(patches[0].rel_path, rel);
    }

    #[test]
    fn backfill_assigns_asset_id_from_path() {
        let dir = tempdir().unwrap();
        let rel = "assets/v.mp4";
        fs::create_dir_all(dir.path().join("assets")).unwrap();
        fs::write(dir.path().join(rel), b"x").unwrap();

        let nodes = vec![FlowNode {
            id: "v1".into(),
            node_type: "videoNode".into(),
            data: json!({ "path": rel }),
        }];
        let patches = reconcile_graph_media_nodes(dir.path(), &nodes).unwrap();
        assert_eq!(patches.len(), 1);
        assert_eq!(patches[0].node_id, "v1");
        assert_eq!(patches[0].rel_path, rel);
        assert!(!patches[0].asset_id.is_empty());

        let got = db::get_asset_by_id(&db::open_run_db(dir.path()).unwrap(), &patches[0].asset_id)
            .unwrap()
            .expect("row");
        assert_eq!(got.rel_path, rel);
    }

    #[test]
    fn backfill_script_storyboard_image_asset_id() {
        let dir = tempdir().unwrap();
        let rel = "assets/story.png";
        fs::create_dir_all(dir.path().join("assets")).unwrap();
        fs::write(dir.path().join(rel), b"x").unwrap();

        let nodes = vec![FlowNode {
            id: "s1".into(),
            node_type: "scriptNode".into(),
            data: json!({
                "storyboardShots": [
                    { "scriptBeatId": "b1", "visualPrompt": "x", "imagePath": rel }
                ]
            }),
        }];
        let patches = backfill_script_asset_ids(dir.path(), &nodes).unwrap();
        assert_eq!(patches.len(), 1);
        let shots = patches[0].storyboard_shots.as_ref().unwrap().as_array().unwrap();
        assert!(shots[0]
            .get("imageAssetId")
            .and_then(|v| v.as_str())
            .map(|s| !s.is_empty())
            .unwrap_or(false));
    }
}
