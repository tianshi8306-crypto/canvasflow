//! Tauri command 请求/响应体（与前端 invoke 的 camelCase 对齐）。

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenericApiSubmitRequest {
    pub url: String,
    #[serde(default)]
    pub method: Option<String>,
    #[serde(default)]
    pub headers: HashMap<String, String>,
    #[serde(default)]
    pub body: serde_json::Value,
    pub task_id_pointer: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenericApiPollRequest {
    pub url: String,
    #[serde(default)]
    pub method: Option<String>,
    #[serde(default)]
    pub headers: HashMap<String, String>,
    #[serde(default)]
    pub body: serde_json::Value,
    pub status_pointer: String,
    #[serde(default)]
    pub done_value: Option<String>,
    #[serde(default)]
    pub result_url_pointer: Option<String>,
    #[serde(default)]
    pub error_pointer: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenericApiSubmitResponse {
    pub task_id: String,
    pub raw: serde_json::Value,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenericApiPollResponse {
    pub status: String,
    pub done: bool,
    pub result_url: Option<String>,
    pub error: Option<String>,
    pub raw: serde_json::Value,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadAssetResponse {
    pub rel_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub asset_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoGenerationStartPayload {
    #[allow(dead_code)]
    pub workflow: String,
    pub model_id: String,
    #[allow(dead_code)]
    pub prompt: String,
    #[serde(default)]
    #[allow(dead_code)]
    pub reference_image_paths: Option<Vec<String>>,
    #[serde(default)]
    #[allow(dead_code)]
    pub reference_video_paths: Option<Vec<String>>,
    #[serde(default)]
    #[allow(dead_code)]
    pub reference_audio_paths: Option<Vec<String>>,
    #[allow(dead_code)]
    pub output: serde_json::Value,
    #[serde(default)]
    #[allow(dead_code)]
    pub camera_movement: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoGenerationStartRequest {
    pub project_path: String,
    pub node_id: String,
    pub payload: VideoGenerationStartPayload,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoGenStartResponse {
    pub job_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DreaminaVideoRecoverRequest {
    pub project_path: String,
    pub node_id: String,
    pub submit_id: String,
    pub model_id: String,
    #[serde(default)]
    pub workflow: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoJobSnapshot {
    pub id: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub progress: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub model_id: String,
    /// 成功落盘后的工程相对路径
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result_rel_path: Option<String>,
}
