//! 从画布 JSON 收集工程内素材相对路径（用于删除节点后 GC）

use serde_json::Value;
use std::collections::HashSet;

fn maybe_insert_asset_path(out: &mut HashSet<String>, raw: &str) {
    let t = raw.trim().replace('\\', "/");
    if t.starts_with("assets/") && !t.contains("..") {
        out.insert(t);
    }
}

fn walk_value(value: &Value, out: &mut HashSet<String>) {
    match value {
        Value::String(s) => maybe_insert_asset_path(out, s),
        Value::Array(arr) => {
            for v in arr {
                walk_value(v, out);
            }
        }
        Value::Object(map) => {
            for v in map.values() {
                walk_value(v, out);
            }
        }
        _ => {}
    }
}

/// 递归扫描 JSON 中所有 `assets/...` 字符串引用
pub fn collect_asset_rel_paths(value: &Value) -> HashSet<String> {
    let mut out = HashSet::new();
    walk_value(value, &mut out);
    out
}

/// 从画布 nodes 数组收集仍被引用的素材路径
pub fn collect_asset_rel_paths_from_nodes(nodes: &Value) -> HashSet<String> {
    collect_asset_rel_paths(nodes)
}
