use std::path::{Path, PathBuf};

use crate::db;
use crate::graph::FlowNode;

/// 从节点 data 解析稳定的 `assetId`（有则返回；否则按 `path` 查索引）。
pub fn resolve_node_media_asset_id(
    project_root: &Path,
    data: &serde_json::Value,
) -> Option<String> {
    if let Some(asset_id) = data.get("assetId").and_then(|v| v.as_str()) {
        let trimmed = asset_id.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }
    let path = data.get("path").and_then(|v| v.as_str()).unwrap_or("").trim();
    if path.is_empty() {
        return None;
    }
    if let Ok(conn) = db::open_run_db(project_root) {
        if let Ok(Some(row)) = db::get_asset_by_rel_path(&conn, path) {
            return Some(row.asset_id);
        }
    }
    None
}

/// 从节点 data 解析媒体相对路径：优先 `asset_id` 查库，回退 `path`。
pub fn resolve_node_media_rel_path(
    project_root: &Path,
    data: &serde_json::Value,
) -> Option<String> {
    if let Some(asset_id) = data.get("assetId").and_then(|v| v.as_str()) {
        let trimmed = asset_id.trim();
        if !trimmed.is_empty() {
            if let Ok(conn) = db::open_run_db(project_root) {
                if let Ok(Some(row)) = db::get_asset_by_id(&conn, trimmed) {
                    return Some(row.rel_path);
                }
            }
        }
    }
    let path = data.get("path").and_then(|v| v.as_str()).unwrap_or("").trim();
    if path.is_empty() {
        None
    } else {
        Some(path.to_string())
    }
}

pub fn resolve_node_media_abs_path(project_root: &Path, node: &FlowNode) -> Option<PathBuf> {
    resolve_node_media_rel_path(project_root, &node.data).map(|rel| project_root.join(rel))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn resolve_rel_path_prefers_asset_id_over_stale_path() {
        let dir = tempdir().unwrap();
        let rel = "assets/current.png";
        fs::create_dir_all(dir.path().join("assets")).unwrap();
        fs::write(dir.path().join(rel), b"x").unwrap();
        let conn = db::open_run_db(dir.path()).unwrap();
        let aid = db::upsert_asset(&conn, rel, "image", None, None).unwrap();

        let data = json!({ "assetId": aid, "path": "assets/stale.png" });
        let resolved = resolve_node_media_rel_path(dir.path(), &data).expect("path");
        assert_eq!(resolved, rel);
    }

    #[test]
    fn resolve_asset_id_from_path_index() {
        let dir = tempdir().unwrap();
        let rel = "assets/a.mp3";
        fs::create_dir_all(dir.path().join("assets")).unwrap();
        fs::write(dir.path().join(rel), b"x").unwrap();
        let conn = db::open_run_db(dir.path()).unwrap();
        let aid = db::upsert_asset(&conn, rel, "audio", None, None).unwrap();

        let data = json!({ "path": rel });
        assert_eq!(
            resolve_node_media_asset_id(dir.path(), &data).as_deref(),
            Some(aid.as_str())
        );
    }
}
