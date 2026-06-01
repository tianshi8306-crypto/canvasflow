use crate::canvas_asset_backfill::{self, CanvasAssetBackfillResult};
use crate::command_common::media_type_from_ext;
use crate::db;
use crate::graph::FlowNode;
use crate::media;
use crate::project_asset_store;
use std::path::PathBuf;

#[tauri::command]
pub fn list_assets(project_path: String, limit: Option<i64>) -> Result<Vec<db::AssetSummary>, String> {
    let path = PathBuf::from(project_path);
    let conn = db::open_run_db(&path)?;
    db::list_assets(&conn, limit.unwrap_or(200))
}

#[tauri::command]
pub fn get_asset_by_id(
    project_path: String,
    asset_id: String,
) -> Result<Option<db::AssetSummary>, String> {
    let path = PathBuf::from(project_path);
    let conn = db::open_run_db(&path)?;
    db::get_asset_by_id(&conn, &asset_id)
}

#[tauri::command]
pub fn get_asset_by_rel_path(
    project_path: String,
    rel_path: String,
) -> Result<Option<db::AssetSummary>, String> {
    let path = PathBuf::from(project_path);
    let conn = db::open_run_db(&path)?;
    db::get_asset_by_rel_path(&conn, &rel_path)
}

#[tauri::command]
pub fn import_media_files(
    project_path: String,
    file_paths: Vec<String>,
) -> Result<Vec<db::ImportedMediaItem>, String> {
    let root = PathBuf::from(&project_path);
    let conn = db::open_run_db(&root)?;
    let mut imported = Vec::new();
    for src in file_paths {
        let src_path = PathBuf::from(&src);
        let rel = project_asset_store::import_file_to_project(&root, &src_path)?;
        let asset_id = db::get_asset_by_rel_path(&conn, &rel)?
            .map(|a| a.asset_id)
            .ok_or_else(|| format!("导入后未找到素材索引：{rel}"))?;
        imported.push(db::ImportedMediaItem {
            asset_id,
            rel_path: rel,
        });
    }

    Ok(imported)
}

/// 递归扫描工程 `assets/`（含类型子目录），登记未索引文件。
#[tauri::command]
pub fn sync_assets_index(project_path: String) -> Result<i64, String> {
    let root = PathBuf::from(&project_path);
    let conn = db::open_run_db(&root)?;
    let mut count: i64 = 0;
    project_asset_store::walk_project_assets(&root, |path, rel| {
        if db::get_asset_by_rel_path(&conn, rel)?.is_some() {
            return Ok(());
        }
        let ext = path
            .extension()
            .and_then(|x| x.to_str())
            .unwrap_or("")
            .to_string();
        let media_type = media_type_from_ext(&ext);
        let meta_json = match media_type {
            "image" => media::meta_json_for_image(path),
            "video" => media::meta_json_for_av(path, "video"),
            "audio" => media::meta_json_for_av(path, "audio"),
            _ => None,
        };
        let source_label = if rel.contains("/import/") {
            "import"
        } else if rel.contains("/gen/") {
            "sync"
        } else {
            "sync"
        };
        let _aid = db::upsert_asset(&conn, rel, media_type, Some(source_label), meta_json.as_deref())?;
        count += 1;
        Ok(())
    })?;
    Ok(count)
}

/// 将 `assets/` 根目录旧扁平文件迁移到 `assets/gen/` / `assets/import/`。
#[tauri::command]
pub fn migrate_legacy_assets(
    project_path: String,
    dry_run: Option<bool>,
) -> Result<crate::asset_migration::AssetMigrationResult, String> {
    let root = PathBuf::from(&project_path);
    crate::asset_migration::migrate_legacy_assets(&root, dry_run.unwrap_or(false))
}

/// 打开工程时对齐画布资产引用：path→assetId（M2）与 assetId→path（M4），含脚本镜字段。
#[tauri::command]
pub fn backfill_canvas_asset_ids(
    project_path: String,
    nodes: Vec<FlowNode>,
) -> Result<CanvasAssetBackfillResult, String> {
    canvas_asset_backfill::backfill_canvas_assets(&PathBuf::from(project_path), &nodes)
}
