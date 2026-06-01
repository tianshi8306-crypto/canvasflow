//! DAG 节点 `outputs` 与运行日志中的媒体产出编码（M3：path + assetId 双写）。

use serde_json::{json, Value};

const OUTPUT_REL_PATH_KEY: &str = "relPath";
const OUTPUT_ASSET_ID_KEY: &str = "assetId";

/// 媒体节点写入 `outputs` 映射的值：有 `assetId` 时为 JSON，否则保持裸路径（兼容旧运行）。
pub fn encode_media_output_value(rel_path: &str, asset_id: Option<&str>) -> String {
    let rel = rel_path.trim();
    if let Some(id) = asset_id.map(str::trim).filter(|s| !s.is_empty()) {
        return serde_json::to_string(&json!({
            OUTPUT_REL_PATH_KEY: rel,
            OUTPUT_ASSET_ID_KEY: id,
        }))
        .unwrap_or_else(|_| rel.to_string());
    }
    rel.to_string()
}

/// 从 `outputs` 映射或历史运行记录解析工程相对路径（兼容裸路径与 M3 JSON）。
pub fn decode_output_rel_path(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    if let Ok(v) = serde_json::from_str::<Value>(trimmed) {
        if let Some(p) = v.get(OUTPUT_REL_PATH_KEY).and_then(|x| x.as_str()) {
            return p.trim().to_string();
        }
    }
    trimmed.to_string()
}

/// 从 M3 JSON 产出解析 `assetId`；裸路径或纯文本返回 `None`。
pub fn decode_output_asset_id(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    let v = serde_json::from_str::<Value>(trimmed).ok()?;
    v.get(OUTPUT_ASSET_ID_KEY)
        .and_then(|x| x.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
}

/// 从上一次运行的 `node_output` 事件载荷恢复 `outputs` 条目。
pub fn output_value_from_run_event_payload(payload: &Value) -> Option<String> {
    let rel = payload.get("output").and_then(|v| v.as_str())?;
    let asset_id = payload
        .get(OUTPUT_ASSET_ID_KEY)
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty());
    Some(encode_media_output_value(rel, asset_id))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_decode_media_output_roundtrip() {
        let raw = encode_media_output_value("assets/a.png", Some("id-1"));
        assert_eq!(decode_output_rel_path(&raw), "assets/a.png");
        assert_eq!(decode_output_asset_id(&raw).as_deref(), Some("id-1"));
    }

    #[test]
    fn decode_legacy_plain_path() {
        assert_eq!(decode_output_rel_path("assets/legacy.mp4"), "assets/legacy.mp4");
        assert!(decode_output_asset_id("assets/legacy.mp4").is_none());
    }
}
