use crate::command_common::media_type_from_ext;
use crate::db;
use crate::media;
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
    let assets_dir = root.join("assets");
    std::fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;
    let conn = db::open_run_db(&root)?;

    let mut imported = Vec::new();
    for src in file_paths {
        let src_path = PathBuf::from(&src);
        let file_name = src_path
            .file_name()
            .ok_or_else(|| format!("非法路径: {}", src))?
            .to_string_lossy()
            .to_string();
        let dst = assets_dir.join(&file_name);
        std::fs::copy(&src_path, &dst).map_err(|e| format!("复制失败 {}: {}", src, e))?;
        let rel = format!("assets/{}", file_name);

        let ext = dst
            .extension()
            .and_then(|x| x.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        let media_type = media_type_from_ext(&ext);

        let meta_json = match media_type {
            "image" => media::meta_json_for_image(&dst),
            "video" => media::meta_json_for_av(&dst, "video"),
            "audio" => media::meta_json_for_av(&dst, "audio"),
            _ => None,
        };
        let asset_id = db::upsert_asset(&conn, &rel, media_type, Some("import"), meta_json.as_deref())?;
        imported.push(db::ImportedMediaItem {
            asset_id,
            rel_path: rel,
        });
    }

    Ok(imported)
}

/// 扫描工程 `assets/` 目录，将已有文件登记到素材索引（适合手动拷入 assets 后一键入库）。
#[tauri::command]
pub fn sync_assets_index(project_path: String) -> Result<i64, String> {
    let root = PathBuf::from(&project_path);
    let assets_dir = root.join("assets");
    if !assets_dir.is_dir() {
        return Ok(0);
    }
    let conn = db::open_run_db(&root)?;
    let mut count: i64 = 0;
    for entry in std::fs::read_dir(&assets_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let file_name = entry.file_name().to_string_lossy().to_string();
        let rel = format!("assets/{}", file_name);
        let ext = path
            .extension()
            .and_then(|x| x.to_str())
            .unwrap_or("")
            .to_string();
        let media_type = media_type_from_ext(&ext);
        let meta_json = match media_type {
            "image" => media::meta_json_for_image(&path),
            "video" => media::meta_json_for_av(&path, "video"),
            "audio" => media::meta_json_for_av(&path, "audio"),
            _ => None,
        };
        let _aid = db::upsert_asset(&conn, &rel, media_type, Some("sync"), meta_json.as_deref())?;
        count += 1;
    }
    Ok(count)
}
