use crate::dreamina_cli::{DreaminaCliState, DreaminaCliStatus, DreaminaLoginRuntime};
use crate::AppState;
use tauri::State;

#[tauri::command]
pub fn dreamina_cli_status(
    dreamina: State<'_, DreaminaCliState>,
    refresh: Option<bool>,
) -> Result<DreaminaCliStatus, String> {
    dreamina.get_status(refresh.unwrap_or(false))
}

#[tauri::command]
pub fn dreamina_cli_login_runtime(
    dreamina: State<'_, DreaminaCliState>,
) -> Result<DreaminaLoginRuntime, String> {
    Ok(dreamina.get_login_runtime())
}

#[tauri::command]
pub fn dreamina_cli_start_login(
    dreamina: State<'_, DreaminaCliState>,
    mode: Option<String>,
    force: Option<bool>,
) -> Result<DreaminaLoginRuntime, String> {
    let mode = mode.unwrap_or_else(|| "headless".into());
    dreamina.start_login(&mode, force.unwrap_or(false))
}

#[tauri::command]
pub fn dreamina_cli_logout(dreamina: State<'_, DreaminaCliState>) -> Result<DreaminaCliStatus, String> {
    dreamina.logout()
}

#[tauri::command]
pub fn dreamina_cli_qr_base64(dreamina: State<'_, DreaminaCliState>) -> Result<Option<String>, String> {
    Ok(dreamina.get_qr_base64())
}

#[tauri::command]
pub fn dreamina_cli_open_authorize_url(
    app: tauri::AppHandle,
    dreamina: State<'_, DreaminaCliState>,
) -> Result<(), String> {
    dreamina.open_authorize_url(&app)
}

pub fn init_dreamina_state(app_state: &AppState) -> DreaminaCliState {
    DreaminaCliState::new(app_state.http.clone())
}
