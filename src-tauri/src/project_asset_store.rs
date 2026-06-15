//! 工程素材统一落盘：
//! - 图片 / 视频 → 扁平目录 `assets/{kind}/{序号}.{ext}`（按生成顺序编号）
//! - 音频等 → `assets/{kind}/import/` 或 `assets/{kind}/gen/{source}/`

use crate::command_common::media_type_from_ext;
use crate::db;
use crate::media;
use serde_json::json;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy)]
pub struct AssetWriteContext<'a> {
    pub kind: &'a str,
    pub source: &'a str,
    pub workflow: Option<&'a str>,
    pub node_id: Option<&'a str>,
    pub job_id: Option<&'a str>,
}

pub fn workflow_short_code(workflow: &str) -> &str {
    match workflow.trim() {
        "text_to_video" | "text2video" => "t2v",
        "image_to_video" | "image2video" => "i2v",
        "first_last_frame" | "frames2video" => "fl2v",
        "multimodal_reference" | "image_reference" | "video_reference" | "multimodal2video" => "mm",
        other if !other.is_empty() && other.len() <= 12 => other,
        _ => "gen",
    }
}

fn sanitize_token(raw: &str, max_len: usize) -> String {
    let cleaned: String = raw
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect();
    if cleaned.is_empty() {
        "na".to_string()
    } else {
        cleaned.chars().take(max_len).collect()
    }
}

fn short_id(raw: Option<&str>, max_len: usize) -> String {
    raw.map(|s| sanitize_token(s, max_len))
        .unwrap_or_else(|| "na".to_string())
}

fn sanitize_import_filename(name: &str) -> String {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return "import.bin".to_string();
    }
    let safe: String = trimmed
        .chars()
        .map(|c| {
            if c == '/' || c == '\\' || c == ':' || c == '*' || c == '?' || c == '"' || c == '<' || c == '>' || c == '|'
            {
                '_'
            } else {
                c
            }
        })
        .collect();
    safe.trim_start_matches('.').to_string()
}

fn ensure_unique_path(abs_dir: &Path, file_name: &str) -> PathBuf {
    let mut dest = abs_dir.join(file_name);
    if !dest.exists() {
        return dest;
    }
    let path = Path::new(file_name);
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("import");
    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .map(|e| format!(".{e}"))
        .unwrap_or_default();
    let uniq = &uuid::Uuid::new_v4().to_string()[..4];
    dest = abs_dir.join(format!("{stem}_{uniq}{ext}"));
    dest
}

fn uses_flat_media_dir(kind: &str) -> bool {
    matches!(kind, "image" | "video")
}

/// `assets/image/000001.png` 或 `assets/video/000042.mp4`
pub fn is_flat_media_rel(rel: &str) -> bool {
    let p = rel.replace('\\', "/");
    let parts: Vec<&str> = p.split('/').collect();
    parts.len() == 3
        && parts[0] == "assets"
        && matches!(parts[1], "image" | "video")
        && !parts[2].is_empty()
}

fn parse_flat_seq_from_name(name: &str) -> Option<u64> {
    let stem = Path::new(name)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("");
    if stem.len() != 6 || !stem.chars().all(|c| c.is_ascii_digit()) {
        return None;
    }
    stem.parse().ok()
}

/// 扫描磁盘上已有扁平序号（含旧嵌套目录中的 6 位序号文件名）
pub fn scan_max_flat_sequence(project_path: &Path, kind: &str) -> u64 {
    let mut max_seq = 0u64;
    let kind_dir = project_path.join(format!("assets/{kind}"));
    if kind_dir.is_dir() {
        scan_dir_max_seq(&kind_dir, &mut max_seq);
    }
    max_seq
}

fn scan_dir_max_seq(dir: &Path, max_seq: &mut u64) {
    let entries = fs::read_dir(dir).ok();
    if entries.is_none() {
        return;
    }
    for entry in entries.unwrap().flatten() {
        let path = entry.path();
        if path.is_dir() {
            scan_dir_max_seq(&path, max_seq);
            continue;
        }
        if !path.is_file() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if let Some(seq) = parse_flat_seq_from_name(&name) {
            *max_seq = (*max_seq).max(seq);
        }
    }
}

/// 图片/视频：按工程序号分配 `assets/{kind}/{000001}.{ext}`
pub fn allocate_sequential_media_path(
    project_path: &Path,
    kind: &str,
    ext: &str,
) -> Result<(String, PathBuf), String> {
    let kind = kind.trim().to_lowercase();
    if !uses_flat_media_dir(&kind) {
        return Err(format!("扁平序号目录仅用于 image/video，收到：{kind}"));
    }
    let ext = ext.trim_start_matches('.').to_lowercase();
    if ext.is_empty() {
        return Err("扩展名不能为空".into());
    }
    let conn = db::open_run_db(project_path)?;
    let disk_max = scan_max_flat_sequence(project_path, &kind);
    db::seed_asset_sequence(&conn, &kind, disk_max)?;
    let seq = db::bump_asset_sequence(&conn, &kind)?;
    let file_name = format!("{:06}.{}", seq, ext);
    let rel_dir = format!("assets/{kind}");
    let abs_dir = project_path.join(&rel_dir);
    fs::create_dir_all(&abs_dir).map_err(|e| format!("创建素材目录失败：{e}"))?;
    let rel = format!("{rel_dir}/{file_name}");
    Ok((rel, abs_dir.join(&file_name)))
}

/// 用户导入：图片/视频走序号；其余类型保留原文件名
pub fn allocate_import_asset_paths(
    project_path: &Path,
    kind: &str,
    original_file_name: &str,
) -> Result<(String, PathBuf), String> {
    let kind = kind.trim().to_lowercase();
    if kind != "video" && kind != "image" && kind != "audio" && kind != "file" {
        return Err(format!("不支持的素材 kind：{kind}"));
    }
    if uses_flat_media_dir(&kind) {
        let ext = Path::new(original_file_name)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or(if kind == "video" { "mp4" } else { "png" });
        return allocate_sequential_media_path(project_path, &kind, ext);
    }
    let file_name = sanitize_import_filename(original_file_name);
    let rel_dir = format!("assets/{kind}/import");
    let abs_dir = project_path.join(&rel_dir);
    fs::create_dir_all(&abs_dir).map_err(|e| format!("创建导入目录失败：{e}"))?;
    let abs = ensure_unique_path(&abs_dir, &file_name);
    let rel = format!(
        "{}/{}",
        rel_dir,
        abs.file_name()
            .and_then(|s| s.to_str())
            .unwrap_or(&file_name)
    );
    Ok((rel, abs))
}

/// 分配工程内相对路径与绝对路径（不写入磁盘）
pub fn allocate_project_asset_paths(
    project_path: &Path,
    ext: &str,
    ctx: &AssetWriteContext,
) -> Result<(String, PathBuf), String> {
    let kind = ctx.kind.trim().to_lowercase();
    if kind != "video" && kind != "image" && kind != "audio" && kind != "file" {
        return Err(format!("不支持的素材 kind：{}", kind));
    }
    let ext = ext.trim_start_matches('.').to_lowercase();
    if ext.is_empty() {
        return Err("扩展名不能为空".into());
    }
    if uses_flat_media_dir(&kind) {
        return allocate_sequential_media_path(project_path, &kind, &ext);
    }

    let source = sanitize_token(ctx.source, 24).to_lowercase();
    let wf = ctx.workflow.map(workflow_short_code).unwrap_or("gen");
    let date = chrono::Utc::now().format("%Y%m%d");
    let job = short_id(ctx.job_id, 32);
    let node = short_id(ctx.node_id, 8);
    let uniq = &uuid::Uuid::new_v4().to_string()[..4];

    let file_name = format!("{source}_{wf}_{date}_{job}_{node}_{uniq}.{ext}");
    let rel_dir = format!("assets/{kind}/gen/{source}");
    let rel = format!("{rel_dir}/{file_name}");
    let abs_dir = project_path.join(&rel_dir);
    fs::create_dir_all(&abs_dir).map_err(|e| format!("创建素材目录失败：{e}"))?;
    Ok((rel, abs_dir.join(&file_name)))
}

fn build_meta_with_provenance(path: &Path, kind: &str, ctx: &AssetWriteContext) -> Option<String> {
    let base = match kind {
        "video" | "audio" => media::meta_json_for_av(path, kind),
        _ => media::meta_json_for_image(path),
    };
    let mut value = base
        .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
        .unwrap_or_else(|| json!({ "version": 1, "kind": kind }));
    if let Some(obj) = value.as_object_mut() {
        obj.insert("provider".into(), json!(ctx.source));
        if let Some(job_id) = ctx.job_id.filter(|s| !s.trim().is_empty()) {
            obj.insert("jobId".into(), json!(job_id));
        }
        if let Some(node_id) = ctx.node_id.filter(|s| !s.trim().is_empty()) {
            obj.insert("nodeId".into(), json!(node_id));
        }
        if let Some(workflow) = ctx.workflow.filter(|s| !s.trim().is_empty()) {
            obj.insert("workflow".into(), json!(workflow));
        }
    }
    serde_json::to_string(&value).ok()
}

/// 为已落盘文件构建带 provenance 的 meta_json（迁移/登记复用）
pub fn build_asset_meta(path: &Path, ctx: &AssetWriteContext) -> Option<String> {
    build_meta_with_provenance(path, ctx.kind, ctx)
}

fn register_asset(
    project_path: &Path,
    abs: &Path,
    rel: &str,
    ctx: &AssetWriteContext,
) -> Result<String, String> {
    let conn = db::open_run_db(project_path)?;
    let meta = build_meta_with_provenance(abs, ctx.kind, ctx);
    let asset_id = db::upsert_asset(
        &conn,
        rel,
        ctx.kind,
        Some(ctx.source),
        meta.as_deref(),
    )?;
    Ok(asset_id)
}

/// 文件已写入目标路径后登记索引
pub fn register_asset_at_path(
    project_path: &Path,
    abs: &Path,
    ctx: &AssetWriteContext,
) -> Result<String, String> {
    let rel = abs
        .strip_prefix(project_path)
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .replace('\\', "/");
    register_asset(project_path, abs, &rel, ctx)?;
    Ok(rel)
}

/// 若同 jobId 的生成物已存在且文件仍在，直接返回 rel_path（避免重复下载/扣费后重复落盘）
pub fn find_existing_gen_asset_by_job_id(
    project_path: &Path,
    kind: &str,
    job_id: &str,
) -> Result<Option<String>, String> {
    let conn = db::open_run_db(project_path)?;
    let Some(rel) = db::find_gen_asset_by_job_id(&conn, kind, job_id)? else {
        return Ok(None);
    };
    let abs = project_path.join(&rel);
    if abs.is_file() {
        Ok(Some(rel))
    } else {
        Ok(None)
    }
}

/// 从外部路径导入到 `assets/import/{kind}/`
pub fn import_file_to_project(project_path: &Path, source: &Path) -> Result<String, String> {
    let file_name = source
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or_else(|| format!("非法路径：{}", source.display()))?;
    let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let kind = media_type_from_ext(&ext);
    let (rel, dest) = allocate_import_asset_paths(project_path, kind, file_name)?;
    fs::copy(source, &dest).map_err(|e| format!("复制导入文件失败：{e}"))?;
    let ctx = AssetWriteContext {
        kind,
        source: "import",
        workflow: None,
        node_id: None,
        job_id: None,
    };
    register_asset_at_path(project_path, &dest, &ctx)?;
    Ok(rel)
}

pub fn copy_file_to_project_asset(
    project_path: &Path,
    source: &Path,
    ctx: &AssetWriteContext,
) -> Result<String, String> {
    let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or(match ctx.kind {
            "video" => "mp4",
            "audio" => "mp3",
            _ => "png",
        });
    let (rel, dest) = allocate_project_asset_paths(project_path, ext, ctx)?;
    fs::copy(source, &dest).map_err(|e| format!("复制生成结果失败：{e}"))?;
    register_asset_at_path(project_path, &dest, ctx)?;
    Ok(rel)
}

pub fn write_bytes_to_project_asset(
    project_path: &Path,
    bytes: &[u8],
    ext: &str,
    ctx: &AssetWriteContext,
) -> Result<String, String> {
    let (rel, dest) = allocate_project_asset_paths(project_path, ext, ctx)?;
    fs::write(&dest, bytes).map_err(|e| format!("保存素材失败：{e}"))?;
    register_asset_at_path(project_path, &dest, ctx)?;
    Ok(rel)
}

/// 递归扫描 `assets/` 下文件（跳过隐藏目录）
pub fn walk_project_assets<F>(project_path: &Path, mut visit: F) -> Result<(), String>
where
    F: FnMut(&Path, &str) -> Result<(), String>,
{
    let assets_root = project_path.join("assets");
    if !assets_root.is_dir() {
        return Ok(());
    }
    walk_assets_recursive(&assets_root, project_path, &mut visit)
}

fn walk_assets_recursive(
    dir: &Path,
    project_root: &Path,
    visit: &mut dyn FnMut(&Path, &str) -> Result<(), String>,
) -> Result<(), String> {
    for entry in fs::read_dir(dir).map_err(|e| format!("读取目录失败：{e}"))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        if path.is_dir() {
            walk_assets_recursive(&path, project_root, visit)?;
            continue;
        }
        if !path.is_file() {
            continue;
        }
        let rel = path
            .strip_prefix(project_root)
            .map_err(|e| e.to_string())?
            .to_string_lossy()
            .replace('\\', "/");
        visit(&path, &rel)?;
    }
    Ok(())
}

const ASSET_KINDS: &[&str] = &["video", "image", "audio", "file"];

/// 是否为规范路径（扁平 image/video、音频嵌套目录、导出目录）
pub fn is_canonical_asset_rel(rel: &str) -> bool {
    let p = rel.replace('\\', "/").to_lowercase();
    if p.starts_with("assets/export/") || p.starts_with("assets/exports/") {
        return true;
    }
    if is_flat_media_rel(rel) {
        return true;
    }
    for kind in ASSET_KINDS {
        if p.starts_with(&format!("assets/{kind}/import/"))
            || p.starts_with(&format!("assets/{kind}/gen/"))
        {
            return true;
        }
    }
    false
}

/// 是否位于嵌套旧目录（import/gen 子文件夹内的图片/视频，整理时需迁入扁平目录）
pub fn is_nested_legacy_media_rel(rel: &str) -> bool {
    let p = rel.replace('\\', "/").to_lowercase();
    for kind in ["image", "video"] {
        if p.starts_with(&format!("assets/{kind}/import/"))
            || p.contains(&format!("assets/{kind}/gen/"))
        {
            return true;
        }
    }
    false
}

/// 画布删除后可清理的素材（不含导出成品）
pub fn is_gc_eligible_asset_rel(rel: &str) -> bool {
    let p = rel.replace('\\', "/").to_lowercase();
    if p.starts_with("assets/export/") || p.starts_with("assets/exports/") {
        return false;
    }
    if is_flat_media_rel(rel) || is_nested_legacy_media_rel(rel) {
        return true;
    }
    for kind in ASSET_KINDS {
        if p.starts_with(&format!("assets/{kind}/import/"))
            || p.starts_with(&format!("assets/{kind}/gen/"))
        {
            return true;
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn workflow_short_codes() {
        assert_eq!(workflow_short_code("text_to_video"), "t2v");
        assert_eq!(workflow_short_code("first_last_frame"), "fl2v");
    }

    #[test]
    fn allocates_gen_video_path_flat() {
        let dir = tempfile::tempdir().expect("tempdir");
        let ctx = AssetWriteContext {
            kind: "video",
            source: "dreamina",
            workflow: Some("text_to_video"),
            node_id: Some("video-node-abc12345"),
            job_id: Some("f64d4c23-d334-415a-bb2f-0383ee8544aa"),
        };
        let (rel, abs) = allocate_project_asset_paths(dir.path(), "mp4", &ctx).expect("alloc");
        assert_eq!(rel, "assets/video/000001.mp4");
        assert!(abs.is_file() || !abs.exists());
        let (rel2, _) = allocate_project_asset_paths(dir.path(), "mp4", &ctx).expect("alloc2");
        assert_eq!(rel2, "assets/video/000002.mp4");
    }

    #[test]
    fn allocates_import_path_flat() {
        let dir = tempfile::tempdir().expect("tempdir");
        let (rel, _) =
            allocate_import_asset_paths(dir.path(), "video", "My Clip.mp4").expect("alloc");
        assert_eq!(rel, "assets/video/000001.mp4");
    }

    #[test]
    fn allocates_audio_import_keeps_name() {
        let dir = tempfile::tempdir().expect("tempdir");
        let (rel, _) =
            allocate_import_asset_paths(dir.path(), "audio", "voice.mp3").expect("alloc");
        assert_eq!(rel, "assets/audio/import/voice.mp3");
    }
}
