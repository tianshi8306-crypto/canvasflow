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
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            providers: vec![ProviderConfig {
                id: "openai-compatible-1".into(),
                label: "OpenAI 兼容".into(),
                base_url: "https://api.openai.com/v1".into(),
                model: "gpt-4o-mini".into(),
                priority: 0,
                enabled: true,
            }],
            default_provider_id: Some("openai-compatible-1".into()),
            ffmpeg_path: None,
            image_models: Vec::new(),
            video_models: Vec::new(),
            audio_models: Vec::new(),
            abort_workflow_on_failure: false,
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
