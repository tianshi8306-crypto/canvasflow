use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet, VecDeque};

/// 从 `source` 沿有向边能到达的所有节点（不含 `source` 自身）。用于节点失败后标记下游为 skipped。
pub fn downstream_descendants(graph: &CanvasGraph, source: &str) -> HashSet<String> {
    let mut out = HashSet::new();
    let mut stack = vec![source.to_string()];
    while let Some(u) = stack.pop() {
        for e in &graph.edges {
            if e.source == u && out.insert(e.target.clone()) {
                stack.push(e.target.clone());
            }
        }
    }
    out.remove(source);
    out
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct FlowNode {
    pub id: String,
    #[serde(rename = "type")]
    pub node_type: String,
    pub data: serde_json::Value,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FlowEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    #[serde(default)]
    pub source_handle: Option<String>,
    #[serde(default)]
    pub target_handle: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CanvasGraph {
    pub nodes: Vec<FlowNode>,
    pub edges: Vec<FlowEdge>,
}

pub fn validate_dag(graph: &CanvasGraph) -> Result<(), String> {
    let mut adj: HashMap<String, Vec<String>> = HashMap::new();
    let mut nodes: HashSet<String> = HashSet::new();
    for n in &graph.nodes {
        nodes.insert(n.id.clone());
    }
    for e in &graph.edges {
        if !nodes.contains(&e.source) {
            return Err(format!("边引用了不存在的源节点: {}", e.source));
        }
        if !nodes.contains(&e.target) {
            return Err(format!("边引用了不存在的目标节点: {}", e.target));
        }
        adj.entry(e.source.clone())
            .or_default()
            .push(e.target.clone());
    }
    let mut indeg: HashMap<String, usize> = HashMap::new();
    for n in &graph.nodes {
        indeg.insert(n.id.clone(), 0);
    }
    for (_s, tgts) in &adj {
        for t in tgts {
            *indeg.entry(t.clone()).or_insert(0) += 1;
        }
    }
    let mut q: VecDeque<String> = VecDeque::new();
    for (id, &deg) in &indeg {
        if deg == 0 {
            q.push_back(id.clone());
        }
    }
    let mut visited = 0usize;
    while let Some(u) = q.pop_front() {
        visited += 1;
        if let Some(nexts) = adj.get(&u) {
            for v in nexts {
                let entry = indeg.get_mut(v).ok_or_else(|| "内部错误: indeg".to_string())?;
                *entry -= 1;
                if *entry == 0 {
                    q.push_back(v.clone());
                }
            }
        }
    }
    if visited != graph.nodes.len() {
        return Err("工作流图中存在环路，无法执行".into());
    }
    Ok(())
}

pub fn topological_order(graph: &CanvasGraph) -> Result<Vec<String>, String> {
    validate_dag(graph)?;
    let mut adj: HashMap<String, Vec<String>> = HashMap::new();
    for e in &graph.edges {
        adj.entry(e.source.clone())
            .or_default()
            .push(e.target.clone());
    }
    let mut indeg: HashMap<String, usize> = HashMap::new();
    for n in &graph.nodes {
        indeg.insert(n.id.clone(), 0);
    }
    for (_s, tgts) in &adj {
        for t in tgts {
            *indeg.entry(t.clone()).or_insert(0) += 1;
        }
    }
    let mut q: VecDeque<String> = VecDeque::new();
    for (id, &deg) in &indeg {
        if deg == 0 {
            q.push_back(id.clone());
        }
    }
    let mut order = Vec::new();
    while let Some(u) = q.pop_front() {
        order.push(u.clone());
        if let Some(nexts) = adj.get(&u) {
            for v in nexts {
                let entry = indeg.get_mut(v).ok_or_else(|| "内部错误: indeg".to_string())?;
                *entry -= 1;
                if *entry == 0 {
                    q.push_back(v.clone());
                }
            }
        }
    }
    if order.len() != graph.nodes.len() {
        return Err("拓扑排序失败".into());
    }
    Ok(order)
}

#[cfg(test)]
mod downstream_tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn downstream_descendants_chain() {
        let g = CanvasGraph {
            nodes: vec![
                FlowNode {
                    id: "a".into(),
                    node_type: "textNode".into(),
                    data: json!({}),
                },
                FlowNode {
                    id: "b".into(),
                    node_type: "textNode".into(),
                    data: json!({}),
                },
                FlowNode {
                    id: "c".into(),
                    node_type: "textNode".into(),
                    data: json!({}),
                },
            ],
            edges: vec![
                FlowEdge {
                    id: "e1".into(),
                    source: "a".into(),
                    target: "b".into(),
                    source_handle: None,
                    target_handle: None,
                },
                FlowEdge {
                    id: "e2".into(),
                    source: "b".into(),
                    target: "c".into(),
                    source_handle: None,
                    target_handle: None,
                },
            ],
        };
        let d = downstream_descendants(&g, "a");
        assert!(d.contains("b") && d.contains("c"));
        assert!(!d.contains("a"));
    }
}
