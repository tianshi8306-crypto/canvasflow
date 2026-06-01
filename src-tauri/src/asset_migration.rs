//! 将非规范素材路径整理为类型优先目录：
//! `assets/{kind}/import/`、`assets/{kind}/gen/{source}/`

use crate::command_common::media_type_from_ext;
use crate::db;
use crate::project_asset_store::{self, AssetWriteContext};
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetMigrationItem {
    pub old_rel_path: String,
    pub new_rel_path: String,
    pub target: String,
    pub skipped: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skip_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetMigrationResult {
    pub dry_run: bool,
    pub migrated_count: usize,
    pub skipped_count: usize,
    pub canvas_path_updates: usize,
    pub path_mappings: HashMap<String, String>,
    pub items: Vec<AssetMigrationItem>,
}

#[derive(Debug, Clone)]
enum MigrationPlan {
    Import {
        kind: String,
        file_name: String,
    },
    Gen {
        ctx: OwnedWriteContext,
        ext: String,
    },
    Restructure {
        new_rel: String,
        ctx: OwnedWriteContext,
    },
}

#[derive(Debug, Clone)]
struct OwnedWriteContext {
    kind: String,
    source: String,
    workflow: Option<String>,
    node_id: Option<String>,
    job_id: Option<String>,
}

impl OwnedWriteContext {
    fn as_ref_ctx(&self) -> AssetWriteContext<'_> {
        AssetWriteContext {
            kind: &self.kind,
            source: &self.source,
            workflow: self.workflow.as_deref(),
            node_id: self.node_id.as_deref(),
            job_id: self.job_id.as_deref(),
        }
    }
}

pub fn is_legacy_flat_asset_rel(rel: &str) -> bool {
    let p = rel.replace('\\', "/");
    if !p.starts_with("assets/") {
        return false;
    }
    let rest = p.trim_start_matches("assets/");
    !rest.is_empty() && !rest.contains('/')
}

/// 旧版 `assets/gen/{kind}/...` / `assets/import/{kind}/...` → 类型优先路径（保留文件名）
pub fn restructure_legacy_layout_rel(rel: &str) -> Option<String> {
    let p = rel.replace('\\', "/");
    if let Some(rest) = p.strip_prefix("assets/gen/") {
        let parts: Vec<&str> = rest.split('/').collect();
        if parts.len() >= 3 {
            let kind = parts[0];
            let source = parts[1];
            let file = parts[2..].join("/");
            return Some(format!("assets/{kind}/gen/{source}/{file}"));
        }
    }
    if let Some(rest) = p.strip_prefix("assets/import/") {
        let parts: Vec<&str> = rest.split('/').collect();
        if parts.len() >= 2 {
            let kind = parts[0];
            let file = parts[1..].join("/");
            return Some(format!("assets/{kind}/import/{file}"));
        }
    }
    None
}

fn meta_provider(meta_json: Option<&str>) -> Option<String> {
    let raw = meta_json?;
    let value: Value = serde_json::from_str(raw).ok()?;
    value
        .get("provider")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn meta_job_id(meta_json: Option<&str>) -> Option<String> {
    let raw = meta_json?;
    let value: Value = serde_json::from_str(raw).ok()?;
    value
        .get("jobId")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn legacy_stem_job_id(file_name: &str) -> Option<String> {
    let stem = Path::new(file_name).file_stem()?.to_str()?;
    let parts: Vec<&str> = stem.split('-').collect();
    if parts.len() >= 3 {
        let prefix = parts[0];
        if matches!(prefix, "audio" | "video")
            && matches!(parts.get(1).copied(), Some("extract" | "trim" | "delogo"))
        {
            return Some(parts[2].to_string());
        }
    }
    if stem.starts_with("dreamina_vid_") {
        return Some(stem.trim_start_matches("dreamina_vid_").to_string());
    }
    if stem.starts_with("mock_video_") {
        return Some(stem.trim_start_matches("mock_video_").to_string());
    }
    if let Some(rest) = stem.strip_prefix("gen_") {
        let segs: Vec<&str> = rest.split('_').collect();
        if let Some(last) = segs.last() {
            if last.len() >= 8 {
                return Some((*last).to_string());
            }
        }
    }
    if let Some(rest) = stem.strip_prefix("tts_") {
        return Some(rest.to_string());
    }
    if let Some(rest) = stem.strip_prefix("video_") {
        return Some(rest.to_string());
    }
    Some(stem.to_string())
}

pub fn classify_legacy_asset(
    file_name: &str,
    media_type: &str,
    source: Option<&str>,
    meta_json: Option<&str>,
) -> MigrationPlan {
    let lower = file_name.to_ascii_lowercase();
    let provider = meta_provider(meta_json);
    let job_id = meta_job_id(meta_json).or_else(|| legacy_stem_job_id(file_name));
    let src = source.unwrap_or("").trim();

    let gen = |kind: &str, source: &str, workflow: Option<&str>| MigrationPlan::Gen {
        ctx: OwnedWriteContext {
            kind: kind.to_string(),
            source: source.to_string(),
            workflow: workflow.map(str::to_string),
            node_id: None,
            job_id: job_id.clone(),
        },
        ext: Path::new(file_name)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("bin")
            .to_string(),
    };

    if lower.starts_with("dreamina_vid")
        || src == "dreamina"
        || provider.as_deref() == Some("dreamina")
    {
        return gen("video", "dreamina", Some("gen"));
    }
    if lower.starts_with("mock_video") || src == "mock" || provider.as_deref() == Some("mock") {
        return gen("video", "mock", Some("gen"));
    }
    if lower.starts_with("audio-extract-")
        || src == "video-audio-extract"
        || provider.as_deref() == Some("tools")
    {
        return gen("audio", "tools", Some("extract"));
    }
    if lower.starts_with("video-trim-") || src == "video-trim" {
        return gen("video", "tools", Some("trim"));
    }
    if lower.starts_with("video-delogo-") || src == "video-delogo" {
        return gen("video", "tools", Some("delogo"));
    }
    if lower.starts_with("gen_") || src == "generate" || provider.as_deref() == Some("generate") {
        return gen("image", "generate", Some("gen"));
    }
    if lower.starts_with("tts_") || src == "tts" || provider.as_deref() == Some("tts") {
        return gen("audio", "tts", None);
    }
    if (lower.starts_with("video_") && media_type == "video")
        || src == "seedance"
        || provider.as_deref() == Some("seedance")
    {
        return gen("video", "seedance", Some("gen"));
    }
    if (lower.starts_with("image_") && media_type == "image") || src == "download" {
        return gen(media_type, "download", None);
    }

    MigrationPlan::Import {
        kind: media_type.to_string(),
        file_name: file_name.to_string(),
    }
}

fn ctx_from_restructured_rel(new_rel: &str) -> Option<OwnedWriteContext> {
    let p = new_rel.replace('\\', "/");
    if let Some(rest) = p.strip_prefix("assets/") {
        let parts: Vec<&str> = rest.split('/').collect();
        if parts.len() >= 3 && parts[1] == "import" {
            return Some(OwnedWriteContext {
                kind: parts[0].to_string(),
                source: "import".into(),
                workflow: None,
                node_id: None,
                job_id: None,
            });
        }
        if parts.len() >= 4 && parts[1] == "gen" {
            return Some(OwnedWriteContext {
                kind: parts[0].to_string(),
                source: parts[2].to_string(),
                workflow: None,
                node_id: None,
                job_id: None,
            });
        }
    }
    None
}

fn plan_for_rel(
    rel: &str,
    media_type: &str,
    source: Option<&str>,
    meta_json: Option<&str>,
) -> Result<(MigrationPlan, String), String> {
    if let Some(new_rel) = restructure_legacy_layout_rel(rel) {
        let ctx = ctx_from_restructured_rel(&new_rel)
            .ok_or_else(|| format!("无法解析旧版路径：{rel}"))?;
        let target = format!("{}/{}", ctx.kind, if ctx.source == "import" { "import" } else { "gen" });
        return Ok((
            MigrationPlan::Restructure {
                new_rel: new_rel.clone(),
                ctx,
            },
            target,
        ));
    }

    if !is_legacy_flat_asset_rel(rel) {
        return Err("不在整理范围内".into());
    }

    let file_name = Path::new(rel)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("");
    let plan = classify_legacy_asset(file_name, media_type, source, meta_json);
    let target = match &plan {
        MigrationPlan::Import { kind, .. } => format!("{kind}/import"),
        MigrationPlan::Gen { ctx, .. } => format!("{}/gen/{}", ctx.kind, ctx.source),
        MigrationPlan::Restructure { .. } => unreachable!(),
    };
    Ok((plan, target))
}

fn resolve_target_paths(
    project_path: &Path,
    plan: &MigrationPlan,
) -> Result<(String, PathBuf), String> {
    match plan {
        MigrationPlan::Restructure { new_rel, .. } => {
            let abs = project_path.join(new_rel);
            Ok((new_rel.clone(), abs))
        }
        MigrationPlan::Import { kind, file_name } => {
            project_asset_store::allocate_import_asset_paths(project_path, kind, file_name)
        }
        MigrationPlan::Gen { ctx, ext } => {
            project_asset_store::allocate_project_asset_paths(project_path, ext, &ctx.as_ref_ctx())
        }
    }
}

fn list_non_canonical_asset_files(project_path: &Path) -> Result<Vec<(String, PathBuf)>, String> {
    let mut out = Vec::new();
    project_asset_store::walk_project_assets(project_path, |path, rel| {
        if project_asset_store::is_canonical_asset_rel(rel) {
            return Ok(());
        }
        out.push((rel.to_string(), path.to_path_buf()));
        Ok(())
    })?;
    out.sort_by(|a, b| a.0.cmp(&b.0));
    Ok(out)
}

fn replace_paths_in_json(value: &mut Value, mappings: &HashMap<String, String>) -> usize {
    let mut count = 0;
    match value {
        Value::Object(map) => {
            for v in map.values_mut() {
                count += replace_paths_in_json(v, mappings);
            }
        }
        Value::Array(arr) => {
            for v in arr.iter_mut() {
                count += replace_paths_in_json(v, mappings);
            }
        }
        Value::String(s) => {
            if let Some(next) = mappings.get(s.as_str()) {
                *s = next.clone();
                count += 1;
            }
        }
        _ => {}
    }
    count
}

fn update_canvasflow_paths(
    project_path: &Path,
    mappings: &HashMap<String, String>,
) -> Result<usize, String> {
    if mappings.is_empty() {
        return Ok(0);
    }
    let canvas_path = project_path.join("canvasflow.json");
    if !canvas_path.is_file() {
        return Ok(0);
    }
    let raw = fs::read_to_string(&canvas_path).map_err(|e| format!("读取 canvasflow.json 失败：{e}"))?;
    let mut doc: Value =
        serde_json::from_str(&raw).map_err(|e| format!("解析 canvasflow.json 失败：{e}"))?;
    let count = replace_paths_in_json(&mut doc, mappings);
    if count == 0 {
        return Ok(0);
    }
    let next = serde_json::to_string_pretty(&doc).map_err(|e| e.to_string())?;
    fs::write(&canvas_path, format!("{next}\n")).map_err(|e| format!("写入 canvasflow.json 失败：{e}"))?;
    Ok(count)
}

pub fn migrate_legacy_assets(project_path: &Path, dry_run: bool) -> Result<AssetMigrationResult, String> {
    let conn = db::open_run_db(project_path)?;
    let candidates = list_non_canonical_asset_files(project_path)?;
    let mut items = Vec::new();
    let mut mappings = HashMap::new();
    let mut migrated_count = 0usize;
    let mut skipped_count = 0usize;

    for (old_rel, old_abs) in candidates {
        let ext = old_abs
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        let media_type = media_type_from_ext(&ext);
        let indexed = db::get_asset_by_rel_path(&conn, &old_rel)?;
        let source = indexed.as_ref().and_then(|a| a.source.as_deref());
        let meta = indexed.as_ref().and_then(|a| a.meta_json.as_deref());

        let (plan, target) = match plan_for_rel(&old_rel, media_type, source, meta) {
            Ok(v) => v,
            Err(e) => {
                skipped_count += 1;
                items.push(AssetMigrationItem {
                    old_rel_path: old_rel,
                    new_rel_path: String::new(),
                    target: "skip".into(),
                    skipped: true,
                    skip_reason: Some(e),
                });
                continue;
            }
        };

        let (new_rel, new_abs) = match resolve_target_paths(project_path, &plan) {
            Ok(v) => v,
            Err(e) => {
                skipped_count += 1;
                items.push(AssetMigrationItem {
                    old_rel_path: old_rel,
                    new_rel_path: String::new(),
                    target,
                    skipped: true,
                    skip_reason: Some(e),
                });
                continue;
            }
        };

        if new_abs.exists() && new_abs != old_abs {
            skipped_count += 1;
            items.push(AssetMigrationItem {
                old_rel_path: old_rel,
                new_rel_path: new_rel.clone(),
                target,
                skipped: true,
                skip_reason: Some(format!("目标已存在：{new_rel}")),
            });
            continue;
        }

        if dry_run {
            items.push(AssetMigrationItem {
                old_rel_path: old_rel.clone(),
                new_rel_path: new_rel.clone(),
                target,
                skipped: false,
                skip_reason: None,
            });
            mappings.insert(old_rel, new_rel);
            migrated_count += 1;
            continue;
        }

        if let Some(parent) = new_abs.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("创建目录失败：{e}"))?;
        }
        fs::rename(&old_abs, &new_abs).map_err(|e| {
            format!("移动 {} → {} 失败：{e}", old_rel, new_rel)
        })?;

        let ctx = match &plan {
            MigrationPlan::Import { kind, .. } => AssetWriteContext {
                kind,
                source: "import",
                workflow: None,
                node_id: None,
                job_id: None,
            },
            MigrationPlan::Gen { ctx, .. } | MigrationPlan::Restructure { ctx, .. } => {
                ctx.as_ref_ctx()
            }
        };
        let meta = project_asset_store::build_asset_meta(&new_abs, &ctx);

        if db::relocate_asset_rel_path(
            &conn,
            &old_rel,
            &new_rel,
            media_type,
            Some(ctx.source),
            meta.as_deref(),
        )?
        .is_none()
        {
            project_asset_store::register_asset_at_path(project_path, &new_abs, &ctx)?;
        }

        mappings.insert(old_rel.clone(), new_rel.clone());
        items.push(AssetMigrationItem {
            old_rel_path: old_rel,
            new_rel_path: new_rel,
            target,
            skipped: false,
            skip_reason: None,
        });
        migrated_count += 1;
    }

    let canvas_path_updates = if dry_run {
        0
    } else {
        update_canvasflow_paths(project_path, &mappings)?
    };

    Ok(AssetMigrationResult {
        dry_run,
        migrated_count,
        skipped_count,
        canvas_path_updates,
        path_mappings: mappings,
        items,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_legacy_flat_paths() {
        assert!(is_legacy_flat_asset_rel("assets/old.mp4"));
        assert!(!is_legacy_flat_asset_rel("assets/video/gen/a.mp4"));
    }

    #[test]
    fn restructures_old_gen_import_layout() {
        assert_eq!(
            restructure_legacy_layout_rel("assets/gen/video/dreamina/foo.mp4").as_deref(),
            Some("assets/video/gen/dreamina/foo.mp4")
        );
        assert_eq!(
            restructure_legacy_layout_rel("assets/import/image/hero.png").as_deref(),
            Some("assets/image/import/hero.png")
        );
    }

    #[test]
    fn canonical_paths_skip_migration() {
        assert!(project_asset_store::is_canonical_asset_rel(
            "assets/video/import/hero.mp4"
        ));
        assert!(project_asset_store::is_canonical_asset_rel(
            "assets/image/gen/generate/x.png"
        ));
        assert!(!project_asset_store::is_canonical_asset_rel(
            "assets/gen/video/dreamina/x.mp4"
        ));
    }
}
