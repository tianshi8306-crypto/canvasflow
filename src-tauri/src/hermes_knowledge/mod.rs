//! Hermes 影视知识库：Markdown 分片 + SQLite FTS5 本地检索。

use rusqlite::{params, Connection};
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use crate::settings;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeSearchHit {
    pub doc_id: String,
    pub category: String,
    pub title: String,
    pub body: String,
    pub source_path: String,
    pub score: f64,
}

#[derive(Debug, Clone)]
struct KnowledgeChunk {
    doc_id: String,
    category: String,
    title: String,
    body: String,
    tags: String,
    source_path: String,
}

fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法解析应用数据目录：{e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("创建数据目录失败：{e}"))?;
    Ok(dir.join("hermes_knowledge.db"))
}

const FTS_TABLE_DDL: &str = r#"
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
    doc_id UNINDEXED,
    category UNINDEXED,
    source_path UNINDEXED,
    title,
    body,
    tags,
    tokenize='unicode61'
);
"#;

fn open_db(path: &Path) -> Result<Connection, String> {
    let conn = Connection::open(path).map_err(|e| format!("打开知识库失败：{e}"))?;
    conn.execute_batch(&format!("PRAGMA journal_mode=WAL; {FTS_TABLE_DDL}"))
        .map_err(|e| format!("初始化知识库表失败：{e}"))?;
    Ok(conn)
}

fn scene_to_category(scene: &str) -> Option<&'static str> {
    match scene.trim().to_lowercase().as_str() {
        "workflow" | "sop" => Some("sop"),
        "param" | "models" => Some("models"),
        "creative" | "film_theory" | "theory" | "general" | "general_film" | "film" => {
            Some("creative")
        }
        "troubleshoot" => Some("troubleshoot"),
        _ => None,
    }
}

pub fn knowledge_roots(app: &AppHandle) -> Vec<PathBuf> {
    let mut roots = Vec::new();
    if let Ok(p) = app.path().resolve("hermes-knowledge", tauri::path::BaseDirectory::Resource) {
        if p.is_dir() {
            roots.push(p);
        }
    }
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    for rel in ["resources/hermes-knowledge", "../docs/hermes-knowledge"] {
        let p = manifest.join(rel);
        if p.is_dir() && !roots.iter().any(|r| r == &p) {
            roots.push(p);
        }
    }
    roots
}

fn parse_yaml_line(line: &str) -> Option<(String, String)> {
    let line = line.trim();
    if line.is_empty() || line.starts_with('#') {
        return None;
    }
    let (key, val) = line.split_once(':')?;
    Some((
        key.trim().to_string(),
        val.trim().trim_matches('"').trim_matches('\'').to_string(),
    ))
}

pub fn parse_frontmatter(raw: &str) -> (HashMap<String, String>, String) {
    let trimmed = raw.trim_start();
    if !trimmed.starts_with("---") {
        return (HashMap::new(), raw.to_string());
    }
    let after_open = trimmed.strip_prefix("---").unwrap_or(trimmed).trim_start();
    let Some((yaml, body)) = after_open.split_once("\n---") else {
        return (HashMap::new(), raw.to_string());
    };
    let body = body.trim_start();
    let mut meta = HashMap::new();
    for line in yaml.lines() {
        if let Some((k, v)) = parse_yaml_line(line) {
            meta.insert(k, v);
        }
    }
    (meta, body.to_string())
}

fn split_sections(body: &str) -> Vec<(String, String)> {
    let mut sections: Vec<(String, String)> = Vec::new();
    let mut current_title = String::new();
    let mut current_lines: Vec<String> = Vec::new();

    for line in body.lines() {
        if let Some(h) = line.strip_prefix("## ") {
            if !current_title.is_empty() || !current_lines.is_empty() {
                sections.push((
                    current_title.clone(),
                    current_lines.join("\n").trim().to_string(),
                ));
            }
            current_title = h.trim().to_string();
            current_lines.clear();
            continue;
        }
        if line.starts_with("# ") && current_title.is_empty() && current_lines.is_empty() {
            current_title = line.trim_start_matches('#').trim().to_string();
            continue;
        }
        current_lines.push(line.to_string());
    }
    if !current_title.is_empty() || !current_lines.is_empty() {
        sections.push((
            current_title,
            current_lines.join("\n").trim().to_string(),
        ));
    }
    if sections.is_empty() && !body.trim().is_empty() {
        sections.push(("正文".to_string(), body.trim().to_string()));
    }
    sections
}

fn collect_markdown_files(root: &Path, out: &mut Vec<PathBuf>) -> Result<(), String> {
    let entries = fs::read_dir(root).map_err(|e| format!("读取目录失败 {}: {e}", root.display()))?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_dir() {
            collect_markdown_files(&path, out)?;
        } else if path.extension().and_then(|s| s.to_str()) == Some("md") {
            let name = path.file_name().and_then(|s| s.to_str()).unwrap_or("");
            if name.eq_ignore_ascii_case("readme.md") {
                continue;
            }
            out.push(path);
        }
    }
    Ok(())
}

fn load_chunks_from_file(path: &Path) -> Result<Vec<KnowledgeChunk>, String> {
    let raw = fs::read_to_string(path).map_err(|e| format!("读取 {} 失败: {e}", path.display()))?;
    let (meta, body) = parse_frontmatter(&raw);
    let doc_id = meta
        .get("id")
        .cloned()
        .unwrap_or_else(|| path.file_stem().unwrap().to_string_lossy().to_string());
    let category = meta.get("category").cloned().unwrap_or_else(|| "misc".to_string());
    let tags = meta.get("tags").cloned().unwrap_or_default();
    let rel = path
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| path.display().to_string());

    let sections = split_sections(&body);
    let mut chunks = Vec::new();
    for (title, section_body) in sections {
        if section_body.trim().is_empty() && title.is_empty() {
            continue;
        }
        chunks.push(KnowledgeChunk {
            doc_id: doc_id.clone(),
            category: category.clone(),
            title: if title.is_empty() {
                doc_id.clone()
            } else {
                title
            },
            body: section_body,
            tags: tags.clone(),
            source_path: rel.clone(),
        });
    }
    Ok(chunks)
}

fn rebuild_fts(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(&format!(
        "DROP TABLE IF EXISTS chunks_fts; {}",
        FTS_TABLE_DDL.replace("IF NOT EXISTS ", "")
    ))
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn insert_chunks(conn: &Connection, chunks: &[KnowledgeChunk]) -> Result<usize, String> {
    let mut count = 0usize;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    for ch in chunks {
        tx.execute(
            "INSERT INTO chunks_fts (doc_id, category, source_path, title, body, tags) VALUES (?1,?2,?3,?4,?5,?6)",
            params![
                ch.doc_id,
                ch.category,
                ch.source_path,
                ch.title,
                ch.body,
                ch.tags
            ],
        )
        .map_err(|e| e.to_string())?;
        count += 1;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(count)
}

pub fn reindex_knowledge(
    app: &AppHandle,
    optional_root: Option<String>,
    project_path: Option<String>,
) -> Result<usize, String> {
    let mut roots: Vec<PathBuf> = Vec::new();
    if let Some(r) = optional_root {
        let p = PathBuf::from(r);
        if p.is_dir() {
            roots.push(p);
        }
    }
    if roots.is_empty() {
        roots = knowledge_roots(app);
    }
    if roots.is_empty() {
        return Err("未找到 hermes-knowledge 目录".to_string());
    }

    let mut files = Vec::new();
    for root in &roots {
        collect_markdown_files(root, &mut files)?;
    }
    files.sort();
    files.dedup();

    let mut all_chunks = Vec::new();
    for path in &files {
        all_chunks.extend(load_chunks_from_file(path)?);
    }

    let db = db_path(app)?;
    let conn = open_db(&db)?;
    rebuild_fts(&conn)?;
    let n = insert_chunks(&conn, &all_chunks)?;
    let mut total = n;
    if let Some(pp) = project_path.filter(|p| !p.trim().is_empty()) {
        let memory_root = settings::load_settings(app)
            .ok()
            .and_then(|s| s.hermes_memory_root);
        total += reindex_project_user_knowledge(pp.trim(), memory_root.as_deref())?;
    }
    Ok(total)
}

fn chunk_count(conn: &Connection) -> Result<i64, String> {
    conn.query_row("SELECT COUNT(*) FROM chunks_fts", [], |r| r.get(0))
        .map_err(|e| e.to_string())
}

fn escape_fts_term(term: &str) -> String {
    term.chars()
        .filter(|c| !c.is_whitespace() && *c != '"' && *c != '\'')
        .collect::<String>()
}

fn build_fts_query(query: &str) -> String {
    let terms: Vec<String> = query
        .split_whitespace()
        .map(escape_fts_term)
        .filter(|t| t.len() >= 1)
        .map(|t| format!("\"{t}\""))
        .collect();
    if terms.is_empty() {
        return String::new();
    }
    terms.join(" OR ")
}

pub fn user_knowledge_dir(project_path: &str) -> PathBuf {
    PathBuf::from(project_path)
        .join(".canvasflow")
        .join("hermes-knowledge-user")
}

pub fn project_knowledge_db_path(project_path: &str) -> PathBuf {
    PathBuf::from(project_path)
        .join(".canvasflow")
        .join("hermes-knowledge-index.sqlite")
}

fn project_folder_slug(project_path: &str) -> String {
    let name = std::path::Path::new(project_path)
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "project".to_string());
    let slug: String = name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '-'
            }
        })
        .collect();
    let trimmed = slug.trim_matches('-');
    if trimmed.is_empty() {
        "project".to_string()
    } else {
        trimmed.chars().take(48).collect()
    }
}

/// 用户记忆的 Markdown 目录（自定义根目录下按工程分子文件夹）。
pub fn resolve_user_knowledge_dir(project_path: &str, memory_root: Option<&str>) -> PathBuf {
    if let Some(root) = memory_root.map(str::trim).filter(|s| !s.is_empty()) {
        PathBuf::from(root).join(project_folder_slug(project_path))
    } else {
        user_knowledge_dir(project_path)
    }
}

pub fn resolve_project_knowledge_db_path(project_path: &str, memory_root: Option<&str>) -> PathBuf {
    if hermes_memory_uses_custom_root(memory_root) {
        resolve_user_knowledge_dir(project_path, memory_root).join("hermes-knowledge-index.sqlite")
    } else {
        project_knowledge_db_path(project_path)
    }
}

pub fn hermes_memory_uses_custom_root(memory_root: Option<&str>) -> bool {
    memory_root.map(str::trim).is_some_and(|s| !s.is_empty())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HermesMemoryPaths {
    /// `project` = 工程内 `.canvasflow/`；`custom` = 自定义根目录
    pub mode: String,
    pub memory_root: Option<String>,
    pub user_dir: String,
    pub index_db: String,
    pub project_slug: Option<String>,
}

pub fn normalize_memory_root(memory_root: Option<&str>) -> Option<String> {
    memory_root
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HermesMemoryMigrationResult {
    pub migrated_files: usize,
    pub skipped_files: usize,
    pub conflict_files: usize,
    pub from_dir: String,
    pub to_dir: String,
}

fn same_resolved_path(a: &Path, b: &Path) -> bool {
    match (fs::canonicalize(a), fs::canonicalize(b)) {
        (Ok(x), Ok(y)) => x == y,
        _ => a == b,
    }
}

fn list_user_md_files(dir: &Path) -> Result<Vec<PathBuf>, String> {
    let mut out = Vec::new();
    if !dir.is_dir() {
        return Ok(out);
    }
    for entry in fs::read_dir(dir).map_err(|e| format!("读取目录失败 {}: {e}", dir.display()))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
            out.push(path);
        }
    }
    out.sort();
    Ok(out)
}

fn file_contents_equal(a: &Path, b: &Path) -> Result<bool, String> {
    let a_bytes = fs::read(a).map_err(|e| e.to_string())?;
    let b_bytes = fs::read(b).map_err(|e| e.to_string())?;
    Ok(a_bytes == b_bytes)
}

fn file_modified_secs(path: &Path) -> Option<u64> {
    fs::metadata(path)
        .ok()?
        .modified()
        .ok()?
        .duration_since(std::time::UNIX_EPOCH)
        .ok()
        .map(|d| d.as_secs())
}

/// 将用户记忆从旧保存位置迁移到新位置（切换工程内 / 自定义根目录时调用）。
pub fn migrate_user_knowledge_memory(
    project_path: &str,
    from_memory_root: Option<&str>,
    to_memory_root: Option<&str>,
) -> Result<HermesMemoryMigrationResult, String> {
    let from_root = normalize_memory_root(from_memory_root);
    let to_root = normalize_memory_root(to_memory_root);
    if from_root == to_root {
        let dir = resolve_user_knowledge_dir(project_path, to_root.as_deref());
        return Ok(HermesMemoryMigrationResult {
            migrated_files: 0,
            skipped_files: 0,
            conflict_files: 0,
            from_dir: dir.to_string_lossy().into_owned(),
            to_dir: dir.to_string_lossy().into_owned(),
        });
    }

    let from_dir = resolve_user_knowledge_dir(project_path, from_root.as_deref());
    let to_dir = resolve_user_knowledge_dir(project_path, to_root.as_deref());
    let from_display = from_dir.to_string_lossy().into_owned();
    let to_display = to_dir.to_string_lossy().into_owned();

    if same_resolved_path(&from_dir, &to_dir) {
        return Ok(HermesMemoryMigrationResult {
            migrated_files: 0,
            skipped_files: 0,
            conflict_files: 0,
            from_dir: from_display,
            to_dir: to_display,
        });
    }

    let sources = list_user_md_files(&from_dir)?;
    if sources.is_empty() {
        return Ok(HermesMemoryMigrationResult {
            migrated_files: 0,
            skipped_files: 0,
            conflict_files: 0,
            from_dir: from_display,
            to_dir: to_display,
        });
    }

    fs::create_dir_all(&to_dir).map_err(|e| format!("创建目标目录失败：{e}"))?;

    let mut migrated_files = 0usize;
    let mut skipped_files = 0usize;
    let mut conflict_files = 0usize;

    for src in &sources {
        let name = src
            .file_name()
            .ok_or_else(|| format!("无效文件名：{}", src.display()))?;
        let dest = to_dir.join(name);

        if dest.exists() {
            if file_contents_equal(src, &dest)? {
                skipped_files += 1;
                fs::remove_file(src).map_err(|e| format!("清理已迁移文件失败：{e}"))?;
                continue;
            }
            let src_mtime = file_modified_secs(src);
            let dest_mtime = file_modified_secs(&dest);
            let src_newer = match (src_mtime, dest_mtime) {
                (Some(a), Some(b)) => a > b,
                (Some(_), None) => true,
                _ => false,
            };
            if src_newer {
                fs::copy(src, &dest).map_err(|e| format!("覆盖 {} 失败：{e}", dest.display()))?;
                fs::remove_file(src).map_err(|e| format!("清理源文件失败：{e}"))?;
                migrated_files += 1;
            } else {
                conflict_files += 1;
            }
            continue;
        }

        fs::copy(src, &dest).map_err(|e| format!("复制到 {} 失败：{e}", dest.display()))?;
        fs::remove_file(src).map_err(|e| format!("清理源文件失败：{e}"))?;
        migrated_files += 1;
    }

    if migrated_files > 0 || skipped_files > 0 {
        reindex_project_user_knowledge(project_path, to_root.as_deref())?;
        let old_db = resolve_project_knowledge_db_path(project_path, from_root.as_deref());
        let new_db = resolve_project_knowledge_db_path(project_path, to_root.as_deref());
        if old_db != new_db && old_db.is_file() {
            let _ = fs::remove_file(old_db);
        }
        if from_dir.is_dir() {
            let _ = fs::remove_dir(from_dir);
        }
    }

    Ok(HermesMemoryMigrationResult {
        migrated_files,
        skipped_files,
        conflict_files,
        from_dir: from_display,
        to_dir: to_display,
    })
}

pub fn resolve_memory_paths(project_path: &str, memory_root: Option<&str>) -> HermesMemoryPaths {
    let custom = hermes_memory_uses_custom_root(memory_root);
    let slug = if custom {
        Some(project_folder_slug(project_path))
    } else {
        None
    };
    HermesMemoryPaths {
        mode: if custom { "custom" } else { "project" }.to_string(),
        memory_root: memory_root
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_string),
        user_dir: resolve_user_knowledge_dir(project_path, memory_root)
            .to_string_lossy()
            .into_owned(),
        index_db: resolve_project_knowledge_db_path(project_path, memory_root)
            .to_string_lossy()
            .into_owned(),
        project_slug: slug,
    }
}

fn slugify_doc_id(raw: &str) -> String {
    let lower = raw.trim().to_lowercase();
    let mut out = String::from("user-");
    let mut prev_hyphen = false;
    for ch in lower.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch);
            prev_hyphen = false;
        } else if !prev_hyphen {
            out.push('-');
            prev_hyphen = true;
        }
    }
    let trimmed = out.trim_matches('-').to_string();
    if trimmed.len() <= 5 {
        format!("user-tip-{}", chrono_like_stamp())
    } else {
        trimmed.chars().take(64).collect()
    }
}

fn chrono_like_stamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    ms.to_string()
}

fn extract_json_object(raw: &str) -> Option<String> {
    let start = raw.find('{')?;
    let end = raw.rfind('}')?;
    if end <= start {
        return None;
    }
    Some(raw[start..=end].to_string())
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormattedUserTip {
    pub title: String,
    pub doc_id: Option<String>,
    pub category: Option<String>,
    pub tags: Option<Vec<String>>,
    pub body_markdown: String,
}

fn normalize_category(raw: Option<String>) -> String {
    match raw
        .unwrap_or_else(|| "creative".to_string())
        .trim()
        .to_lowercase()
        .as_str()
    {
        "troubleshoot" => "troubleshoot".to_string(),
        "models" | "model" | "param" => "models".to_string(),
        _ => "creative".to_string(),
    }
}

pub fn compose_user_tip_markdown(parsed: &FormattedUserTip) -> String {
    let title = parsed.title.trim();
    let doc_id = parsed
        .doc_id
        .as_ref()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| slugify_doc_id(title));
    let doc_id = if doc_id.starts_with("user-") {
        doc_id
    } else {
        format!("user-{}", doc_id.trim_start_matches('-'))
    };
    let category = normalize_category(parsed.category.clone());
    let tags: Vec<String> = parsed
        .tags
        .clone()
        .unwrap_or_default()
        .into_iter()
        .map(|t| t.trim().to_string())
        .filter(|t| !t.is_empty())
        .collect();
    let tags_yaml = if tags.is_empty() {
        "[]".to_string()
    } else {
        format!("[{}]", tags.iter().map(|t| format!("\"{t}\"")).collect::<Vec<_>>().join(", "))
    };
    let body = parsed.body_markdown.trim();
    format!(
        "---\nid: {doc_id}\ncategory: {category}\ntags: {tags_yaml}\nsource: user-contribution\n---\n\n# {title}\n\n{body}\n"
    )
}

pub fn parse_formatted_user_tip_json(raw: &str) -> Result<FormattedUserTip, String> {
    let json_str = extract_json_object(raw).unwrap_or_else(|| raw.trim().to_string());
    serde_json::from_str(&json_str).map_err(|e| format!("解析 Hermes 整理结果失败：{e}"))
}

pub fn reindex_project_user_knowledge(
    project_path: &str,
    memory_root: Option<&str>,
) -> Result<usize, String> {
    let user_dir = resolve_user_knowledge_dir(project_path, memory_root);
    fs::create_dir_all(&user_dir).map_err(|e| format!("创建用户知识目录失败：{e}"))?;
    let db = resolve_project_knowledge_db_path(project_path, memory_root);
    if let Some(parent) = db.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建索引目录失败：{e}"))?;
    }

    let mut files = Vec::new();
    if user_dir.is_dir() {
        collect_markdown_files(&user_dir, &mut files)?;
    }
    files.sort();
    files.dedup();

    let mut all_chunks = Vec::new();
    for path in &files {
        all_chunks.extend(load_chunks_from_file(path)?);
    }

    let conn = open_db(&db)?;
    rebuild_fts(&conn)?;
    let n = insert_chunks(&conn, &all_chunks)?;
    Ok(n)
}

pub fn save_user_knowledge_tip(
    project_path: &str,
    markdown: &str,
    memory_root: Option<&str>,
) -> Result<(String, usize), String> {
    let md = markdown.trim();
    if md.is_empty() {
        return Err("Markdown 内容为空".into());
    }
    let (meta, _) = parse_frontmatter(md);
    let doc_id = meta
        .get("id")
        .cloned()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| slugify_doc_id("tip"));
    let file_name = format!("{doc_id}.md");
    let user_dir = resolve_user_knowledge_dir(project_path, memory_root);
    fs::create_dir_all(&user_dir).map_err(|e| format!("创建目录失败：{e}"))?;
    let path = user_dir.join(&file_name);
    fs::write(&path, md).map_err(|e| format!("写入 {file_name} 失败：{e}"))?;
    let rel = if hermes_memory_uses_custom_root(memory_root) {
        path.to_string_lossy().into_owned()
    } else {
        format!(".canvasflow/hermes-knowledge-user/{file_name}")
    };
    let n = reindex_project_user_knowledge(project_path, memory_root)?;
    Ok((rel, n))
}

fn search_db(
    db: &Path,
    category: Option<&str>,
    fts_q: &str,
    like: &str,
    limit: i64,
) -> Result<Vec<KnowledgeSearchHit>, String> {
    if !db.is_file() {
        return Ok(Vec::new());
    }
    let conn = open_db(db)?;
    if chunk_count(&conn)? == 0 {
        return Ok(Vec::new());
    }
    let mut hits = Vec::new();

    if !fts_q.is_empty() {
        let sql = if category.is_some() {
            r#"
            SELECT doc_id, category, title, body, source_path, bm25(chunks_fts) AS score
            FROM chunks_fts
            WHERE chunks_fts MATCH ?1 AND category = ?2
            ORDER BY score
            LIMIT ?3
            "#
        } else {
            r#"
            SELECT doc_id, category, title, body, source_path, bm25(chunks_fts) AS score
            FROM chunks_fts
            WHERE chunks_fts MATCH ?1
            ORDER BY score
            LIMIT ?3
            "#
        };

        let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
        let rows = if let Some(cat) = category {
            stmt.query_map(params![fts_q, cat, limit], map_hit)
        } else {
            stmt.query_map(params![fts_q, limit], map_hit)
        }
        .map_err(|e| e.to_string())?;

        for row in rows {
            hits.push(row.map_err(|e| e.to_string())?);
        }
    }

    if hits.is_empty() && !like.is_empty() {
        let sql = if category.is_some() {
            r#"
            SELECT doc_id, category, title, body, source_path, 0.0 AS score
            FROM chunks_fts
            WHERE (title LIKE ?1 OR body LIKE ?1 OR tags LIKE ?1) AND category = ?2
            LIMIT ?3
            "#
        } else {
            r#"
            SELECT doc_id, category, title, body, source_path, 0.0 AS score
            FROM chunks_fts
            WHERE title LIKE ?1 OR body LIKE ?1 OR tags LIKE ?1
            LIMIT ?3
            "#
        };
        let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
        let rows = if let Some(cat) = category {
            stmt.query_map(params![like, cat, limit], map_hit)
        } else {
            stmt.query_map(params![like, limit], map_hit)
        }
        .map_err(|e| e.to_string())?;
        for row in rows {
            hits.push(row.map_err(|e| e.to_string())?);
        }
    }

    Ok(hits)
}

pub fn search_knowledge(
    app: &AppHandle,
    scene: Option<String>,
    query: String,
    limit: u32,
    project_path: Option<String>,
) -> Result<Vec<KnowledgeSearchHit>, String> {
    let limit = limit.clamp(1, 10) as i64;
    let db = db_path(app)?;
    let conn = open_db(&db)?;

    if chunk_count(&conn)? == 0 {
        let _ = reindex_knowledge(app, None, None);
    }

    let category = scene.as_deref().and_then(scene_to_category);
    let fts_q = build_fts_query(query.trim());
    let like = format!("%{}%", query.trim());
    let mut hits = search_db(&db, category, &fts_q, &like, limit)?;

    if hits.len() < limit as usize {
        let memory_root = settings::load_settings(app)
        .ok()
        .and_then(|s| s.hermes_memory_root);
    let memory_root_ref = memory_root.as_deref();

    if let Some(pp) = project_path.filter(|p| !p.trim().is_empty()) {
            let project_db = resolve_project_knowledge_db_path(pp.trim(), memory_root_ref);
            let remain = limit - hits.len() as i64;
            let mut user_hits = search_db(&project_db, category, &fts_q, &like, remain)?;
            hits.append(&mut user_hits);
        }
    }

    hits.sort_by(|a, b| {
        a.score
            .partial_cmp(&b.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let mut total_chars = 0usize;
    let max_chars = 2000usize;
    let mut trimmed = Vec::new();
    for mut h in hits {
        if trimmed.len() >= limit as usize {
            break;
        }
        if total_chars + h.body.len() > max_chars && !h.body.is_empty() {
            let remain = max_chars.saturating_sub(total_chars);
            if remain < 80 {
                break;
            }
            h.body = h.body.chars().take(remain).collect();
        }
        total_chars += h.body.len();
        trimmed.push(h);
    }

    Ok(trimmed)
}

fn map_hit(row: &rusqlite::Row<'_>) -> rusqlite::Result<KnowledgeSearchHit> {
    Ok(KnowledgeSearchHit {
        doc_id: row.get(0)?,
        category: row.get(1)?,
        title: row.get(2)?,
        body: row.get(3)?,
        source_path: row.get(4)?,
        score: row.get(5)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_markdown_sections() {
        let body = "## A\nline1\n\n## B\nline2";
        let s = split_sections(body);
        assert_eq!(s.len(), 2);
        assert_eq!(s[0].0, "A");
        assert!(s[0].1.contains("line1"));
        assert_eq!(s[1].0, "B");
    }

    #[test]
    fn parses_frontmatter_id() {
        let raw = "---\nid: test-doc\ncategory: sop\n---\n\n## Sec\nbody";
        let (meta, _) = parse_frontmatter(raw);
        assert_eq!(meta.get("id").map(String::as_str), Some("test-doc"));
        assert_eq!(meta.get("category").map(String::as_str), Some("sop"));
    }

    #[test]
    fn resolves_custom_memory_paths() {
        let paths = resolve_memory_paths(
            r"C:\Projects\My Film",
            Some(r"D:\HermesMemory"),
        );
        assert_eq!(paths.mode, "custom");
        assert!(paths.user_dir.contains("HermesMemory"));
        assert!(paths.user_dir.contains("My-Film") || paths.user_dir.contains("My"));
        assert!(paths.index_db.ends_with("hermes-knowledge-index.sqlite"));
    }

    #[test]
    fn resolves_project_memory_paths() {
        let paths = resolve_memory_paths("/tmp/proj", None);
        assert_eq!(paths.mode, "project");
        assert!(paths.user_dir.contains(".canvasflow"));
        assert!(paths.user_dir.contains("hermes-knowledge-user"));
    }

    #[test]
    fn migrates_user_memory_between_roots() {
        let base = std::env::temp_dir().join(format!(
            "hermes-migrate-{}",
            chrono_like_stamp()
        ));
        let _ = fs::remove_dir_all(&base);
        fs::create_dir_all(&base).unwrap();
        let project = base.join("My Project");
        fs::create_dir_all(&project).unwrap();
        let custom_a = base.join("memory-a");
        let custom_b = base.join("memory-b");
        fs::create_dir_all(&custom_a).unwrap();

        let from_dir = resolve_user_knowledge_dir(project.to_str().unwrap(), Some(custom_a.to_str().unwrap()));
        fs::create_dir_all(&from_dir).unwrap();
        fs::write(from_dir.join("user-tip-a.md"), "---\nid: user-tip-a\n---\n\n# A\n\nbody").unwrap();

        let result = migrate_user_knowledge_memory(
            project.to_str().unwrap(),
            Some(custom_a.to_str().unwrap()),
            Some(custom_b.to_str().unwrap()),
        )
        .unwrap();
        assert_eq!(result.migrated_files, 1);

        let to_dir = resolve_user_knowledge_dir(project.to_str().unwrap(), Some(custom_b.to_str().unwrap()));
        assert!(to_dir.join("user-tip-a.md").is_file());
        assert!(!from_dir.join("user-tip-a.md").exists());
    }
}
