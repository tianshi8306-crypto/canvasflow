//! 从画布 DAG 提取 Hermes 资产卡

use crate::graph::{topological_order, CanvasGraph, FlowNode};
use std::collections::{HashMap, HashSet, VecDeque};

use super::graph_flow::node_by_id;
use super::types::AssetCard;

pub fn all_upstream_asset_cards(graph: &CanvasGraph, node_id: &str) -> Vec<AssetCard> {
    let order = match topological_order(graph) {
        Ok(o) => o,
        Err(_) => return Vec::new(),
    };
    let mut topo_index: HashMap<String, usize> = HashMap::new();
    for (i, id) in order.iter().enumerate() {
        topo_index.insert(id.clone(), i);
    }

    let mut visited: HashSet<String> = HashSet::new();
    let mut queue: VecDeque<String> = VecDeque::new();
    for e in &graph.edges {
        if e.target == node_id && visited.insert(e.source.clone()) {
            queue.push_back(e.source.clone());
        }
    }
    while let Some(cur) = queue.pop_front() {
        for e in &graph.edges {
            if e.target == cur && visited.insert(e.source.clone()) {
                queue.push_back(e.source.clone());
            }
        }
    }

    let mut sorted: Vec<(usize, String)> = visited
        .into_iter()
        .filter_map(|id| topo_index.get(&id).map(|&idx| (idx, id)))
        .collect();
    sorted.sort_by_key(|p| p.0);

    sorted
        .into_iter()
        .filter_map(|(_, uid)| node_by_id(graph, &uid).map(extract_asset_card))
        .collect()
}

pub fn project_scope_asset_cards(graph: &CanvasGraph) -> Vec<AssetCard> {
    let order = match topological_order(graph) {
        Ok(o) => o,
        Err(_) => return Vec::new(),
    };
    let mut topo_index: HashMap<String, usize> = HashMap::new();
    for (i, id) in order.iter().enumerate() {
        topo_index.insert(id.clone(), i);
    }
    let mut nodes: Vec<(usize, &FlowNode)> = graph
        .nodes
        .iter()
        .filter(|n| {
            matches!(
                n.node_type.as_str(),
                "scriptNode" | "textNode" | "llm" | "imageNode" | "imageAsset" | "videoNode"
            )
        })
        .filter_map(|n| topo_index.get(&n.id).map(|&idx| (idx, n)))
        .collect();
    nodes.sort_by_key(|p| p.0);
    nodes.into_iter().map(|(_, n)| extract_asset_card(n)).collect()
}

fn extract_asset_card(node: &FlowNode) -> AssetCard {
    match node.node_type.as_str() {
        "textNode" | "llm" => extract_text_card(node),
        "scriptNode" => extract_script_card(node),
        "imageNode" | "imageAsset" => extract_image_card(node),
        "videoNode" => extract_video_card(node),
        "audioNode" => extract_audio_card(node),
        _ => {
            let prompt = node
                .data
                .get("prompt")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            AssetCard {
                node_id: node.id.clone(),
                node_type: node.node_type.clone(),
                label: truncate(prompt, 30),
                summary: truncate(prompt, 500),
                keywords: Vec::new(),
                references: Vec::new(),
            }
        }
    }
}

fn extract_text_card(node: &FlowNode) -> AssetCard {
    let prompt = node.data.get("prompt").and_then(|v| v.as_str()).unwrap_or("");
    AssetCard {
        node_id: node.id.clone(),
        node_type: node.node_type.clone(),
        label: truncate(prompt, 30),
        summary: truncate(prompt, 500),
        keywords: Vec::new(),
        references: Vec::new(),
    }
}

fn extract_script_card(node: &FlowNode) -> AssetCard {
    let prompt = node.data.get("prompt").and_then(|v| v.as_str()).unwrap_or("");
    let beats = node.data.get("scriptBeats").and_then(|v| v.as_array());
    let shots = node.data.get("storyboardShots").and_then(|v| v.as_array());
    let mut summary_parts: Vec<String> = Vec::new();
    if let Some(beats) = beats {
        let descriptions: Vec<&str> = beats
            .iter()
            .filter_map(|b| b.get("description").and_then(|d| d.as_str()))
            .take(8)
            .collect();
        if !descriptions.is_empty() {
            summary_parts.push(format!("剧本节拍：{}", descriptions.join("；")));
        }
    }
    if let Some(shots) = shots {
        let visuals: Vec<&str> = shots
            .iter()
            .filter_map(|s| s.get("visualPrompt").and_then(|d| d.as_str()))
            .take(6)
            .collect();
        if !visuals.is_empty() {
            summary_parts.push(format!("分镜 visual：{}", visuals.join("；")));
        }
    }
    let summary = if summary_parts.is_empty() {
        truncate(prompt, 500)
    } else {
        truncate(&summary_parts.join("\n"), 800)
    };
    AssetCard {
        node_id: node.id.clone(),
        node_type: node.node_type.clone(),
        label: truncate(prompt, 30),
        summary,
        keywords: Vec::new(),
        references: Vec::new(),
    }
}

fn extract_image_card(node: &FlowNode) -> AssetCard {
    let prompt = node
        .data
        .get("prompt")
        .and_then(|v| v.as_str())
        .or_else(|| {
            node.data
                .get("params")
                .and_then(|p| p.get("prompt"))
                .and_then(|v| v.as_str())
        })
        .unwrap_or("");
    let path = node.data.get("path").and_then(|v| v.as_str()).unwrap_or("");
    AssetCard {
        node_id: node.id.clone(),
        node_type: node.node_type.clone(),
        label: truncate(prompt, 30),
        summary: truncate(prompt, 500),
        keywords: Vec::new(),
        references: if path.is_empty() {
            Vec::new()
        } else {
            vec![path.to_string()]
        },
    }
}

fn extract_video_card(node: &FlowNode) -> AssetCard {
    let video = node.data.get("video");
    let prompt = video
        .and_then(|v| v.get("draft"))
        .and_then(|d| d.get("prompt"))
        .and_then(|v| v.as_str())
        .or_else(|| node.data.get("prompt").and_then(|v| v.as_str()))
        .unwrap_or("");
    let path = node.data.get("path").and_then(|v| v.as_str()).unwrap_or("");
    AssetCard {
        node_id: node.id.clone(),
        node_type: node.node_type.clone(),
        label: truncate(prompt, 30),
        summary: truncate(prompt, 500),
        keywords: Vec::new(),
        references: if path.is_empty() {
            Vec::new()
        } else {
            vec![path.to_string()]
        },
    }
}

fn extract_audio_card(node: &FlowNode) -> AssetCard {
    let text = node
        .data
        .get("prompt")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let path = node.data.get("path").and_then(|v| v.as_str()).unwrap_or("");
    AssetCard {
        node_id: node.id.clone(),
        node_type: node.node_type.clone(),
        label: truncate(text, 30),
        summary: truncate(text, 500),
        keywords: Vec::new(),
        references: if path.is_empty() {
            Vec::new()
        } else {
            vec![path.to_string()]
        },
    }
}

fn truncate(s: &str, max_chars: usize) -> String {
    if s.chars().count() <= max_chars {
        s.to_string()
    } else {
        let truncated: String = s.chars().take(max_chars).collect();
        truncated + "…"
    }
}
