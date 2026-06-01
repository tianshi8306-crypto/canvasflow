use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeDataPatch {
    pub node_id: String,
    pub data_patch: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphRunResult {
    pub run_id: String,
    pub node_patches: Vec<NodeDataPatch>,
}

/// Hermes 从画布节点提取的上游资产摘要
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetCard {
    pub node_id: String,
    pub node_type: String,
    pub label: String,
    pub summary: String,
    #[serde(default)]
    pub keywords: Vec<String>,
    #[serde(default)]
    pub references: Vec<String>,
}
