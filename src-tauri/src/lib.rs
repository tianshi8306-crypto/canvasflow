mod asset_migration;
mod canvas_asset_backfill;
mod canvas_asset_refs;
mod canvas_mcp_bridge;
mod command_common;
mod hermes_knowledge;
mod compose_concat;
mod timeline_trim;
mod commands;
mod db;
mod dreamina_cli;
mod dreamina_gen;
pub mod executor;
pub mod graph;
mod mcp_stdio;
mod media;
mod project_asset_store;
pub mod settings;
mod vault;

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

pub struct AppState {
    pub http: reqwest::Client,
    pub(crate) video_jobs: Mutex<HashMap<String, VideoMockJob>>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct VideoMockJob {
    /// 供应商返回的原始 jobId（与 video-jobs 文件名可能经 sanitize 不同）
    #[serde(default)]
    pub(crate) job_id: String,
    pub(crate) project_path: String,
    pub(crate) node_id: String,
    pub(crate) model_id: String,
    pub(crate) polls: u32,
    pub(crate) result_rel_path: Option<String>,
    pub(crate) cancelled: bool,
    /// 即梦 CLI 任务（走 query_result 轮询，跳过 mock 延迟）
    pub(crate) is_dreamina: bool,
    pub(crate) dreamina_workflow: Option<String>,
}

impl AppState {
    pub fn new() -> Self {
        let mut client_builder = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(300));

        // 显式从环境变量读取代理配置，确保在 Windows 等平台上也能正确走代理
        if let Ok(proxy_url) = std::env::var("HTTPS_PROXY")
            .or_else(|_| std::env::var("https_proxy"))
            .or_else(|_| std::env::var("HTTP_PROXY"))
            .or_else(|_| std::env::var("http_proxy"))
            .or_else(|_| std::env::var("ALL_PROXY"))
            .or_else(|_| std::env::var("all_proxy"))
        {
            if let Ok(proxy) = reqwest::Proxy::all(&proxy_url) {
                eprintln!("[AppState] 使用代理: {}", proxy_url);
                client_builder = client_builder.proxy(proxy);
            }
        }

        Self {
            http: client_builder
                .build()
                .expect("failed to build HTTP client"),
            video_jobs: Mutex::new(HashMap::new()),
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState::new();
    let dreamina_state = commands::dreamina_cmd::init_dreamina_state(&app_state);

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .manage(app_state)
        .manage(dreamina_state)
        .manage(Arc::new(canvas_mcp_bridge::CanvasMcpBridge::new()))
        .setup(|app| {
            vault::migrate_plaintext_vault_to_keyring();
            canvas_mcp_bridge::start_canvas_mcp_bridge(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::settings_cmd::load_settings,
            commands::settings_cmd::save_settings,
            commands::settings_cmd::save_api_key,
            commands::settings_cmd::clear_api_key,
            commands::settings_cmd::has_api_key,
            commands::settings_cmd::load_api_key,
            commands::project_cmd::pick_project_folder,
            commands::project_cmd::ensure_project_structure,
            commands::project_cmd::read_canvasflow_json,
            commands::project_cmd::write_canvasflow_json,
            commands::project_cmd::write_canvasflow_json_bytes,
            commands::runs_cmd::list_runs,
            commands::runs_cmd::list_run_events,
            commands::runs_cmd::append_agent_event,
            commands::runs_cmd::append_node_agent_event,
            commands::assets_cmd::list_assets,
            commands::assets_cmd::get_asset_by_id,
            commands::assets_cmd::get_asset_by_rel_path,
            commands::assets_cmd::import_media_files,
            commands::assets_cmd::sync_assets_index,
            commands::assets_cmd::migrate_legacy_assets,
            commands::assets_cmd::backfill_canvas_asset_ids,
            commands::assets_cmd::gc_unreferenced_assets,
            commands::timeline_cmd::render_timeline,
            commands::timeline_cmd::render_timeline_to_path,
            commands::timeline_cmd::reveal_in_shell,
            commands::graph_cmd::execute_graph,
            commands::graph_cmd::execute_graph_with_patch,
            commands::graph_cmd::execute_subgraph,
            commands::graph_cmd::execute_subgraph_with_patch,
            commands::graph_cmd::llm_complete_text,
            commands::hermes_cmd::hermes_chat_stream,
            commands::hermes_cmd::hermes_enhance,
            commands::hermes_cmd::hermes_plan,
            commands::hermes_cmd::hermes_orb_suggest,
            commands::hermes_mcp_cmd::hermes_mcp_list_tools,
            commands::hermes_mcp_cmd::hermes_mcp_call_tool,
            commands::hermes_mcp_cmd::hermes_mcp_probe_server,
            commands::canvas_mcp_bridge_cmd::canvas_mcp_bridge_status,
            commands::canvas_mcp_bridge_cmd::canvas_mcp_bridge_set_context,
            commands::canvas_mcp_bridge_cmd::canvas_mcp_tool_result,
            commands::hermes_knowledge_cmd::hermes_knowledge_search,
            commands::hermes_knowledge_cmd::hermes_knowledge_reindex,
            commands::hermes_knowledge_cmd::hermes_knowledge_format_user_tip,
            commands::hermes_knowledge_cmd::hermes_knowledge_save_user_tip,
            commands::hermes_knowledge_cmd::hermes_knowledge_list_user_tips,
            commands::hermes_knowledge_cmd::hermes_knowledge_reindex_user_project,
            commands::hermes_knowledge_cmd::hermes_knowledge_memory_paths,
            commands::hermes_knowledge_cmd::hermes_knowledge_migrate_user_memory,
            commands::prompt_reverse_cmd::reverse_prompt_from_media,
            commands::media_gen_cmd::generate_image_asset,
            commands::media_gen_cmd::generate_tts_asset,
            commands::media_gen_cmd::transcribe_speech_audio,
            commands::media_gen_cmd::test_image_model_connection,
            commands::generic_api_cmd::generic_async_api_submit,
            commands::generic_api_cmd::generic_async_api_poll,
            commands::download_cmd::download_remote_asset_to_project,
            commands::video_cmd::video_gen_start,
            commands::video_cmd::video_gen_get_job,
            commands::video_cmd::video_gen_cancel,
            commands::video_cmd::video_gen_recover_dreamina,
            commands::video_cmd::video_gen_list_persisted_jobs,
            commands::video_cmd::test_video_model_connection,
            commands::project_cmd::open_project_dir,
            commands::project_cmd::write_project_rel_text_file,
            commands::project_cmd::read_project_rel_text_file,
            commands::project_cmd::probe_project_rel_media,
            commands::project_cmd::probe_project_rel_image,
            commands::project_cmd::list_project_rel_dir_files,
            commands::script_document_cmd::extract_script_document,
            commands::script_document_cmd::extract_script_document_bytes,
            commands::project_cmd::list_group_template_summaries,
            commands::project_cmd::list_workflow_summaries,
            commands::project_cmd::delete_project_rel_file,
            commands::file_cmd::read_file_as_base64,
            commands::file_cmd::write_file_bytes,
            commands::file_cmd::write_file_base64,
            commands::file_cmd::copy_project_file,
            commands::file_cmd::export_project_assets_batch,
            commands::video_tools_cmd::extract_video_audio_to_assets,
            commands::video_tools_cmd::trim_video_to_assets,
            commands::video_tools_cmd::delogo_video_to_assets,
            commands::video_tools_cmd::auto_delogo_video_to_assets,
            commands::video_tools_cmd::platform_export_video,
            commands::bgm_cmd::overlay_bgm_to_video,
            commands::dreamina_cmd::dreamina_cli_status,
            commands::dreamina_cmd::dreamina_cli_login_runtime,
            commands::dreamina_cmd::dreamina_cli_start_login,
            commands::dreamina_cmd::dreamina_cli_logout,
            commands::dreamina_cmd::dreamina_cli_qr_base64,
            commands::dreamina_cmd::dreamina_cli_open_authorize_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
