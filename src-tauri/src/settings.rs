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

fn default_theme_preset() -> String {
    "dark".into()
}

fn default_font_size() -> String {
    "medium".into()
}

fn default_cursor_style() -> String {
    "default".into()
}

fn default_prompt_action_surface() -> String {
    "themed".into()
}

fn default_node_spacing() -> u32 {
    120
}

fn default_node_direction() -> String {
    "right".into()
}

fn default_highlight_color() -> String {
    "white".into()
}

fn default_align_trigger_mode() -> String {
    "click".into()
}

fn default_align_distribute_gap() -> u32 {
    40
}

fn default_upload_quality() -> String {
    "standard".into()
}

fn default_project_auto_save_idle_sec() -> u32 {
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
    /// 任务结束后 LLM 复盘
    #[serde(default = "default_true")]
    pub agent_post_job_llm_reflect: bool,
    /// 灵体对失败/断链建议自动执行
    #[serde(default = "default_true")]
    pub agent_proactive_recovery: bool,
    /// 外接 MCP Server（stdio 子进程）
    #[serde(default)]
    pub hermes_mcp_servers: Vec<crate::mcp_stdio::HermesMcpServerConfig>,

    // ── 外观（与前端 AppSettings 对齐，须持久化到 settings.json）──
    #[serde(default = "default_theme_preset")]
    pub theme_preset: String,
    #[serde(default = "default_font_size")]
    pub font_size: String,
    #[serde(default = "default_cursor_style")]
    pub cursor_style: String,
    #[serde(default = "default_true")]
    pub grid_dots_visible: bool,
    #[serde(default = "default_prompt_action_surface")]
    pub prompt_action_surface: String,

    // ── 节点行为 ──
    #[serde(default = "default_true")]
    pub show_video_meta: bool,
    #[serde(default = "default_true")]
    pub image_video_node_resize_enabled: bool,
    #[serde(default = "default_true")]
    pub prompt_box_resize_enabled: bool,
    #[serde(default = "default_true")]
    pub title_follows_canvas_zoom: bool,
    #[serde(default = "default_node_spacing")]
    pub node_spacing: u32,
    #[serde(default = "default_node_direction")]
    pub node_direction: String,
    #[serde(default = "default_true")]
    pub node_avoid_overlap: bool,

    // ── 画布对齐 ──
    #[serde(default = "default_true")]
    pub selection_related_highlight_enabled: bool,
    #[serde(default = "default_highlight_color")]
    pub selection_related_highlight_color: String,
    #[serde(default = "default_true")]
    pub snap_guides_enabled: bool,
    #[serde(default = "default_true")]
    pub connection_lines_visible: bool,
    #[serde(default)]
    pub snap_grid_enabled: bool,
    #[serde(default = "default_align_trigger_mode")]
    pub align_feature_trigger_mode: String,
    #[serde(default = "default_align_distribute_gap")]
    pub align_distribute_gap: u32,

    // ── 素材 ──
    #[serde(default = "default_upload_quality")]
    pub upload_quality: String,
    #[serde(default = "default_project_auto_save_idle_sec")]
    pub project_auto_save_idle_sec: u32,
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
            agent_post_job_llm_reflect: true,
            agent_proactive_recovery: true,
            hermes_mcp_servers: Vec::new(),
            theme_preset: default_theme_preset(),
            font_size: default_font_size(),
            cursor_style: default_cursor_style(),
            grid_dots_visible: true,
            prompt_action_surface: default_prompt_action_surface(),
            show_video_meta: true,
            image_video_node_resize_enabled: true,
            prompt_box_resize_enabled: true,
            title_follows_canvas_zoom: true,
            node_spacing: default_node_spacing(),
            node_direction: default_node_direction(),
            node_avoid_overlap: true,
            selection_related_highlight_enabled: true,
            selection_related_highlight_color: default_highlight_color(),
            snap_guides_enabled: true,
            connection_lines_visible: true,
            snap_grid_enabled: false,
            align_feature_trigger_mode: default_align_trigger_mode(),
            align_distribute_gap: default_align_distribute_gap(),
            upload_quality: default_upload_quality(),
            project_auto_save_idle_sec: default_project_auto_save_idle_sec(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::AppSettings;

    #[test]
    fn round_trip_theme_preset_light() {
        let json = r#"{
            "providers": [],
            "themePreset": "light",
            "gridDotsVisible": true,
            "snapGuidesEnabled": true,
            "connectionLinesVisible": true,
            "projectAutoSaveIdleSec": 2
        }"#;
        let parsed: AppSettings = serde_json::from_str(json).expect("parse");
        assert_eq!(parsed.theme_preset, "light");
        let out = serde_json::to_string(&parsed).expect("serialize");
        assert!(out.contains("\"themePreset\":\"light\""));
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
