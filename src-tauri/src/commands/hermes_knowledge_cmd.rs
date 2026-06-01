use crate::executor::hermes_agent;
use crate::hermes_knowledge::{
    compose_user_tip_markdown, migrate_user_knowledge_memory, parse_formatted_user_tip_json,
    reindex_knowledge, reindex_project_user_knowledge, resolve_memory_paths,
    resolve_user_knowledge_dir, save_user_knowledge_tip, search_knowledge,
    HermesMemoryMigrationResult, HermesMemoryPaths, KnowledgeSearchHit,
};
use crate::settings;
use crate::AppState;
use serde::Serialize;
use std::fs;
use tauri::AppHandle;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HermesFormattedUserTip {
    pub title: String,
    pub doc_id: String,
    pub category: String,
    pub markdown: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HermesUserTipListItem {
    pub doc_id: String,
    pub title: String,
    pub rel_path: String,
}

fn memory_root_from_app(app: &AppHandle) -> Option<String> {
    settings::load_settings(app)
        .ok()
        .and_then(|s| s.hermes_memory_root)
}

#[tauri::command]
pub fn hermes_knowledge_reindex(
    app: AppHandle,
    knowledge_root: Option<String>,
    project_path: Option<String>,
) -> Result<usize, String> {
    reindex_knowledge(&app, knowledge_root, project_path)
}

#[tauri::command]
pub fn hermes_knowledge_search(
    app: AppHandle,
    scene: Option<String>,
    query: String,
    limit: Option<u32>,
    project_path: Option<String>,
) -> Result<Vec<KnowledgeSearchHit>, String> {
    search_knowledge(
        &app,
        scene,
        query,
        limit.unwrap_or(3),
        project_path,
    )
}

#[tauri::command]
pub fn hermes_knowledge_migrate_user_memory(
    project_path: String,
    from_memory_root: Option<String>,
    to_memory_root: Option<String>,
) -> Result<HermesMemoryMigrationResult, String> {
    migrate_user_knowledge_memory(
        project_path.trim(),
        from_memory_root.as_deref(),
        to_memory_root.as_deref(),
    )
}

#[tauri::command]
pub fn hermes_knowledge_memory_paths(
    app: AppHandle,
    project_path: Option<String>,
) -> Result<HermesMemoryPaths, String> {
    let memory_root = memory_root_from_app(&app);
    let pp = project_path
        .as_deref()
        .map(str::trim)
        .filter(|p| !p.is_empty())
        .unwrap_or(".");
    Ok(resolve_memory_paths(pp, memory_root.as_deref()))
}

#[tauri::command]
pub async fn hermes_knowledge_format_user_tip(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    raw_tip: String,
    provider_id: Option<String>,
    model: Option<String>,
) -> Result<HermesFormattedUserTip, String> {
    let settings = settings::load_settings(&app)?;
    let extra = crate::commands::hermes_cmd::build_extra(provider_id, model);
    let raw = hermes_agent::format_user_knowledge_tip(
        &state.http,
        &settings,
        raw_tip.trim(),
        &extra,
    )
    .await?;
    let parsed = parse_formatted_user_tip_json(&raw)?;
    let title = parsed.title.trim().to_string();
    if title.is_empty() {
        return Err("整理结果缺少标题".into());
    }
    let markdown = compose_user_tip_markdown(&parsed);
    let (meta, _) = crate::hermes_knowledge::parse_frontmatter(&markdown);
    let doc_id = meta
        .get("id")
        .cloned()
        .unwrap_or_else(|| "user-tip".to_string());
    let category = meta
        .get("category")
        .cloned()
        .unwrap_or_else(|| "creative".to_string());
    Ok(HermesFormattedUserTip {
        title,
        doc_id,
        category,
        markdown,
    })
}

#[tauri::command]
pub fn hermes_knowledge_save_user_tip(
    app: AppHandle,
    project_path: String,
    markdown: String,
) -> Result<(String, usize), String> {
    let memory_root = memory_root_from_app(&app);
    save_user_knowledge_tip(
        project_path.trim(),
        markdown.trim(),
        memory_root.as_deref(),
    )
}

#[tauri::command]
pub fn hermes_knowledge_list_user_tips(
    app: AppHandle,
    project_path: String,
) -> Result<Vec<HermesUserTipListItem>, String> {
    let memory_root = memory_root_from_app(&app);
    let dir = resolve_user_knowledge_dir(project_path.trim(), memory_root.as_deref());
    if !dir.is_dir() {
        return Ok(Vec::new());
    }
    let mut items = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("md") {
            continue;
        }
        let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let (meta, body) = crate::hermes_knowledge::parse_frontmatter(&raw);
        let doc_id = meta
            .get("id")
            .cloned()
            .unwrap_or_else(|| path.file_stem().unwrap().to_string_lossy().to_string());
        let title = body
            .lines()
            .find(|l| l.starts_with("# "))
            .map(|l| l.trim_start_matches('#').trim().to_string())
            .unwrap_or_else(|| doc_id.clone());
        let rel_path = if crate::hermes_knowledge::hermes_memory_uses_custom_root(memory_root.as_deref())
        {
            path.to_string_lossy().into_owned()
        } else {
            format!(
                ".canvasflow/hermes-knowledge-user/{}",
                path.file_name().unwrap().to_string_lossy()
            )
        };
        items.push(HermesUserTipListItem {
            doc_id,
            title,
            rel_path,
        });
    }
    items.sort_by(|a, b| a.title.cmp(&b.title));
    Ok(items)
}

#[tauri::command]
pub fn hermes_knowledge_reindex_user_project(
    app: AppHandle,
    project_path: String,
) -> Result<usize, String> {
    let memory_root = memory_root_from_app(&app);
    reindex_project_user_knowledge(project_path.trim(), memory_root.as_deref())
}
