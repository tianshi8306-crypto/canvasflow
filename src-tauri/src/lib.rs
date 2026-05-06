mod command_common;
mod commands;
mod db;
pub mod executor;
pub mod graph;
mod media;
pub mod settings;
mod vault;

use std::collections::HashMap;
use std::sync::Mutex;

pub struct AppState {
    pub http: reqwest::Client,
    pub(crate) video_jobs: Mutex<HashMap<String, VideoMockJob>>,
}

#[derive(Debug, Clone)]
pub(crate) struct VideoMockJob {
    pub(crate) project_path: String,
    pub(crate) node_id: String,
    pub(crate) model_id: String,
    pub(crate) polls: u32,
    pub(crate) result_rel_path: Option<String>,
    pub(crate) cancelled: bool,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            http: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(300))
                .build()
                .expect("failed to build HTTP client"),
            video_jobs: Mutex::new(HashMap::new()),
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::settings_cmd::load_settings,
            commands::settings_cmd::save_settings,
            commands::settings_cmd::save_api_key,
            commands::settings_cmd::clear_api_key,
            commands::settings_cmd::has_api_key,
            commands::project_cmd::pick_project_folder,
            commands::project_cmd::ensure_project_structure,
            commands::project_cmd::read_canvasflow_json,
            commands::project_cmd::write_canvasflow_json,
            commands::runs_cmd::list_runs,
            commands::runs_cmd::list_run_events,
            commands::runs_cmd::append_agent_event,
            commands::assets_cmd::list_assets,
            commands::assets_cmd::get_asset_by_id,
            commands::assets_cmd::get_asset_by_rel_path,
            commands::assets_cmd::import_media_files,
            commands::assets_cmd::sync_assets_index,
            commands::timeline_cmd::render_timeline,
            commands::graph_cmd::execute_graph,
            commands::graph_cmd::execute_graph_with_patch,
            commands::graph_cmd::execute_subgraph,
            commands::graph_cmd::execute_subgraph_with_patch,
            commands::graph_cmd::llm_complete_text,
            commands::media_gen_cmd::generate_image_asset,
            commands::media_gen_cmd::generate_tts_asset,
            commands::media_gen_cmd::test_image_model_connection,
            commands::generic_api_cmd::generic_async_api_submit,
            commands::generic_api_cmd::generic_async_api_poll,
            commands::download_cmd::download_remote_asset_to_project,
            commands::video_cmd::video_gen_start,
            commands::video_cmd::video_gen_get_job,
            commands::video_cmd::video_gen_cancel,
            commands::project_cmd::open_project_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
