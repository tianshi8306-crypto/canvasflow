use crate::executor::asset_resolve::resolve_node_media_rel_path;
use crate::graph::{CanvasGraph, FlowNode};
use serde_json::json;
use std::collections::{HashMap, HashSet};
use std::path::Path;

pub(crate) fn node_by_id<'a>(graph: &'a CanvasGraph, id: &str) -> Option<&'a FlowNode> {
    graph.nodes.iter().find(|n| n.id == id)
}

fn incoming_texts(graph: &CanvasGraph, node_id: &str, outputs: &HashMap<String, String>) -> Vec<String> {
    let mut texts = Vec::new();
    for e in &graph.edges {
        if e.target == node_id {
            if let Some(t) = outputs.get(&e.source) {
                texts.push(t.clone());
            }
        }
    }
    texts
}

/// 多上游文本：按 DAG 拓扑序（越早出现在拓扑序中的节点越靠前）拼接，满足「按拓扑顺序合并」。
pub(crate) fn incoming_texts_ordered(
    graph: &CanvasGraph,
    node_id: &str,
    outputs: &HashMap<String, String>,
) -> Vec<String> {
    let order = match crate::graph::topological_order(graph) {
        Ok(o) => o,
        Err(_) => return incoming_texts(graph, node_id, outputs),
    };
    let mut topo_index: HashMap<String, usize> = HashMap::new();
    for (i, id) in order.iter().enumerate() {
        topo_index.insert(id.clone(), i);
    }
    let mut pairs: Vec<(usize, String)> = Vec::new();
    for e in &graph.edges {
        if e.target == node_id {
            if let Some(t) = outputs.get(&e.source) {
                let idx = topo_index.get(&e.source).copied().unwrap_or(0);
                pairs.push((idx, t.clone()));
            }
        }
    }
    pairs.sort_by_key(|p| p.0);
    pairs.into_iter().map(|(_, s)| s).collect()
}

/// 指向当前节点的上游文本内容（优先使用执行产物 outputs；缺失时回退到 textNode.prompt 原文）。
pub(crate) fn incoming_texts_ordered_with_prompt_fallback(
    graph: &CanvasGraph,
    node_id: &str,
    outputs: &HashMap<String, String>,
) -> Vec<String> {
    let order = match crate::graph::topological_order(graph) {
        Ok(o) => o,
        Err(_) => return incoming_texts_ordered(graph, node_id, outputs),
    };
    let mut topo_index: HashMap<String, usize> = HashMap::new();
    for (i, id) in order.iter().enumerate() {
        topo_index.insert(id.clone(), i);
    }
    let mut pairs: Vec<(usize, String)> = Vec::new();
    for e in &graph.edges {
        if e.target != node_id {
            continue;
        }
        let idx = topo_index.get(&e.source).copied().unwrap_or(0);
        if let Some(t) = outputs.get(&e.source) {
            pairs.push((idx, t.clone()));
            continue;
        }
        if let Some(src) = node_by_id(graph, &e.source) {
            if src.node_type == "textNode" || src.node_type == "llm" {
                let p = src
                    .data
                    .get("prompt")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .trim()
                    .to_string();
                if !p.is_empty() {
                    pairs.push((idx, p));
                }
            }
        }
    }
    pairs.sort_by_key(|p| p.0);
    pairs.into_iter().map(|(_, s)| s).collect()
}

/// 指向脚本节点的上游 `videoNode` 参考视频路径（拓扑序；去重）。
pub(crate) fn incoming_reference_video_paths_ordered(
    project_root: &Path,
    graph: &CanvasGraph,
    node_id: &str,
) -> Vec<String> {
    let order = match crate::graph::topological_order(graph) {
        Ok(o) => o,
        Err(_) => return Vec::new(),
    };
    let mut topo_index: HashMap<String, usize> = HashMap::new();
    for (i, id) in order.iter().enumerate() {
        topo_index.insert(id.clone(), i);
    }
    let mut pairs: Vec<(usize, String)> = Vec::new();
    for e in &graph.edges {
        if e.target != *node_id {
            continue;
        }
        let Some(src) = node_by_id(graph, &e.source) else {
            continue;
        };
        if src.node_type != "videoNode" {
            continue;
        }
        let Some(p) = resolve_node_media_rel_path(project_root, &src.data) else {
            continue;
        };
        let idx = topo_index.get(&e.source).copied().unwrap_or(0);
        pairs.push((idx, p));
    }
    pairs.sort_by_key(|p| p.0);
    let mut seen = HashSet::new();
    let mut out = Vec::new();
    for (_, p) in pairs {
        if seen.insert(p.clone()) {
            out.push(p);
        }
    }
    out
}

/// 指向当前节点的上游 `scriptNode`（按全图拓扑序，越早越靠前；同源只保留一次）。
fn ordered_incoming_script_node_ids(graph: &CanvasGraph, node_id: &str) -> Vec<String> {
    let order = match crate::graph::topological_order(graph) {
        Ok(o) => o,
        Err(_) => return Vec::new(),
    };
    let mut topo_index: HashMap<String, usize> = HashMap::new();
    for (i, id) in order.iter().enumerate() {
        topo_index.insert(id.clone(), i);
    }
    let mut pairs: Vec<(usize, String)> = Vec::new();
    for e in &graph.edges {
        if e.target != node_id {
            continue;
        }
        if !node_by_id(graph, &e.source)
            .map(|n| n.node_type == "scriptNode")
            .unwrap_or(false)
        {
            continue;
        }
        let idx = topo_index.get(&e.source).copied().unwrap_or(0);
        pairs.push((idx, e.source.clone()));
    }
    pairs.sort_by_key(|p| p.0);
    let mut seen = HashSet::new();
    let mut out = Vec::new();
    for (_, id) in pairs {
        if seen.insert(id.clone()) {
            out.push(id);
        }
    }
    out
}

fn beat_shot_number(beat: &serde_json::Value) -> String {
    beat.get("shotNumber")
        .and_then(|v| {
            v.as_str()
                .map(|s| s.to_string())
                .or_else(|| v.as_i64().map(|i| i.to_string()))
                .or_else(|| v.as_f64().map(|f| f.to_string()))
        })
        .unwrap_or_default()
}

/// 图片 / 音频 / 视频节点：若有直连上游脚本且脚本含 `scriptBeats`，解析应绑定的 `scriptBeatId` / `shotNumber`。
fn resolve_script_beat_binding_for_media_node(graph: &CanvasGraph, node: &FlowNode) -> Option<(String, String)> {
    if node.node_type != "imageNode" && node.node_type != "audioNode" && node.node_type != "videoNode" {
        return None;
    }
    let script_ids = ordered_incoming_script_node_ids(graph, &node.id);
    let script_id = script_ids.first()?;
    let script = node_by_id(graph, script_id)?;
    let beats = script.data.get("scriptBeats")?.as_array()?;
    if beats.is_empty() {
        return None;
    }
    let beat_ids: Vec<String> = beats
        .iter()
        .filter_map(|b| b.get("id").and_then(|v| v.as_str()).map(|s| s.to_string()))
        .collect();
    if beat_ids.is_empty() {
        return None;
    }
    let selection: Vec<String> = script
        .data
        .get("scriptBeatSelection")
        .and_then(|v| v.as_array())
        .map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect())
        .unwrap_or_default();
    let cur = node
        .data
        .get("params")
        .and_then(|p| p.get("scriptBeatId"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    let chosen_id = if !cur.is_empty() && beat_ids.iter().any(|id| id == &cur) {
        cur
    } else if !selection.is_empty() {
        selection
            .iter()
            .find(|id| beat_ids.contains(id))
            .cloned()
            .or_else(|| beat_ids.first().cloned())
            .unwrap_or_else(|| beat_ids[0].clone())
    } else {
        beat_ids[0].clone()
    };
    let beat = beats
        .iter()
        .find(|b| b.get("id").and_then(|v| v.as_str()) == Some(chosen_id.as_str()))?;
    let shot = beat_shot_number(beat);
    Some((chosen_id, shot))
}

/// 若与当前 `data.params` 不一致则返回 `{"params":{...}}` patch，否则 `None`。
pub(crate) fn script_beat_params_patch_if_changed(graph: &CanvasGraph, node: &FlowNode) -> Option<serde_json::Value> {
    let (chosen_id, shot) = resolve_script_beat_binding_for_media_node(graph, node)?;
    let params_existing = node.data.get("params").cloned().unwrap_or(json!({}));
    let mut obj = params_existing.as_object().cloned().unwrap_or_default();
    let prev_id = obj
        .get("scriptBeatId")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let prev_shot = obj
        .get("shotNumber")
        .and_then(|v| {
            v.as_str()
                .map(|s| s.to_string())
                .or_else(|| v.as_i64().map(|i| i.to_string()))
                .or_else(|| v.as_f64().map(|f| f.to_string()))
        })
        .unwrap_or_default();
    if prev_id == chosen_id && prev_shot == shot {
        return None;
    }
    obj.insert("scriptBeatId".into(), json!(chosen_id));
    obj.insert("shotNumber".into(), json!(shot));
    Some(json!({ "params": serde_json::Value::Object(obj) }))
}
