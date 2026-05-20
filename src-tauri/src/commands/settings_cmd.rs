use crate::settings::{self, AppSettings};

#[tauri::command]
pub fn load_settings(app: tauri::AppHandle) -> Result<AppSettings, String> {
    settings::load_settings(&app)
}

#[tauri::command]
pub fn save_settings(app: tauri::AppHandle, settings: AppSettings) -> Result<(), String> {
    settings::save_settings(&app, &settings)
}

#[tauri::command]
pub fn save_api_key(provider_id: String, api_key: String) -> Result<(), String> {
    crate::vault::store_api_key(&provider_id, &api_key)
}

#[tauri::command]
pub fn clear_api_key(provider_id: String) -> Result<(), String> {
    crate::vault::delete_api_key(&provider_id)
}

#[tauri::command]
pub fn has_api_key(provider_id: String) -> Result<bool, String> {
    Ok(crate::vault::get_api_key(&provider_id)?.is_some())
}

#[tauri::command]
pub fn load_api_key(provider_id: String) -> Result<Option<String>, String> {
    crate::vault::get_api_key(&provider_id)
}
