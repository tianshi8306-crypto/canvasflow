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
