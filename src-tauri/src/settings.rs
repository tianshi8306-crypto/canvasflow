use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfig {
    pub id: String,
    pub label: String,
    pub base_url: String,
    pub model: String,
    pub priority: i32,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageModelConfig {
    pub id: String,
    #[serde(default)]
    pub vendor_name: String,
    #[serde(default)]
    pub model_name: String,
    #[serde(default)]
    pub model_variant: String,
    pub label: String,
    pub model: String,
    #[serde(default)]
    pub api_base_url: String,
    pub enabled: bool,
    pub priority: i32,
    /// 为 false 时前端多图融合降级为单张图生图
    #[serde(default = "default_true")]
    pub supports_multi_ref_fusion: bool,
    #[serde(default = "default_max_reference_images")]
    pub max_reference_images: u8,
    #[serde(default = "default_true")]
    pub supports_image_edit: bool,
    /// API 端点类型：images | chat，默认 images
    #[serde(default)]
    pub endpoint_type: Option<String>,
}

fn default_true() -> bool {
    true
}

fn default_max_reference_images() -> u8 {
    4
}

fn default_agent_max_concurrent_media() -> u8 {
    2
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default)]
    pub providers: Vec<ProviderConfig>,
    #[serde(default)]
    pub default_provider_id: Option<String>,
    #[serde(default)]
    pub ffmpeg_path: Option<String>,
    #[serde(default)]
    pub image_models: Vec<ImageModelConfig>,
    #[serde(default)]
    pub video_models: Vec<ImageModelConfig>,
    #[serde(default)]
    pub audio_models: Vec<ImageModelConfig>,
    /// 为 true 时任一节点失败即中止整图（与默认「失败下游跳过」相反）。
    #[serde(default)]
    pub abort_workflow_on_failure: bool,
    /// 自定义 Hermes 用户记忆根目录；空则使用各工程内 `.canvasflow/hermes-knowledge-user/`。
    #[serde(default)]
    pub hermes_memory_root: Option<String>,
    /// Hermes Agent：识别制片意图后自动执行（关则仅展示计划，需用户确认）
    #[serde(default = "default_true")]
    pub agent_auto_execute: bool,
    /// 大批量出图/出视频跳过对话「继续」确认
    #[serde(default = "default_true")]
    pub agent_auto_batch: bool,
    /// 允许自动改脚本/分镜
    #[serde(default = "default_true")]
    pub agent_allow_script_edit: bool,
    /// 允许自动提交出图/出视频 API
    #[serde(default = "default_true")]
    pub agent_allow_media_submit: bool,
    /// 同时进行的媒体生成任务上限（1～3）
    #[serde(default = "default_agent_max_concurrent_media")]
    pub agent_max_concurrent_media: u8,
    /// 步内 Agent loop：执行前补齐依赖、失败后规则 recovery
    #[serde(default = "default_true")]
    pub agent_loop_enabled: bool,
    /// 长上下文 workstate 摘要用 LLM（关则仅规则压缩）
    #[serde(default = "default_true")]
    pub agent_long_context_llm_summary: bool,
    /// 外接 MCP Server（stdio 子进程）
    #[serde(default)]
    pub hermes_mcp_servers: Vec<crate::mcp_stdio::HermesMcpServerConfig>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            providers: vec![ProviderConfig {
                id: "deepseek".into(),
                label: "DeepSeek".into(),
                base_url: "https://api.deepseek.com/v1".into(),
                model: "deepseek-v4-flash".into(),
                priority: 0,
                enabled: true,
            }],
            default_provider_id: Some("deepseek".into()),
            ffmpeg_path: None,
            image_models: Vec::new(),
            video_models: Vec::new(),
            audio_models: Vec::new(),
            abort_workflow_on_failure: false,
            hermes_memory_root: None,
            agent_auto_execute: true,
            agent_auto_batch: true,
            agent_allow_script_edit: true,
            agent_allow_media_submit: true,
            agent_max_concurrent_media: default_agent_max_concurrent_media(),
            agent_loop_enabled: true,
            agent_long_context_llm_summary: true,
            hermes_mcp_servers: Vec::new(),
        }
    }
}

pub fn settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let mut dir = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    dir.push("settings.json");
    Ok(dir)
}

pub fn load_settings(app: &tauri::AppHandle) -> Result<AppSettings, String> {
    let path = settings_path(app)?;
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let raw = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let s: AppSettings = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    Ok(s)
}

pub fn save_settings(app: &tauri::AppHandle, settings: &AppSettings) -> Result<(), String> {
    let path = settings_path(app)?;
    let raw = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    std::fs::write(&path, raw).map_err(|e| e.to_string())?;
    Ok(())
}
