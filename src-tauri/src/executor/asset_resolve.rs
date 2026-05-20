use std::path::{Path, PathBuf};

use crate::db;
use crate::graph::FlowNode;

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
