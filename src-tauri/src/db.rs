use rusqlite::{params, Connection};
use serde::Serialize;
use std::collections::HashSet;
use std::path::Path;

pub fn open_run_db(project_root: &Path) -> Result<Connection, String> {
    let dir = project_root.join(".canvasflow");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let db_path = dir.join("runs.db");
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    init_schema(&conn)?;
    migrate_assets_asset_id(&conn)?;
    Ok(conn)
}

fn init_schema(conn: &Connection) -> Result<(), String> {
    conn
        .execute_batch(
            r#"
        CREATE TABLE IF NOT EXISTS runs (
            id TEXT PRIMARY KEY,
            started_at TEXT NOT NULL,
            finished_at TEXT,
            status TEXT NOT NULL,
            error TEXT
        );
        CREATE TABLE IF NOT EXISTS run_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id TEXT NOT NULL,
            ts TEXT NOT NULL,
            node_id TEXT,
            kind TEXT NOT NULL,
            payload_json TEXT,
            FOREIGN KEY (run_id) REFERENCES runs(id)
        );
        CREATE TABLE IF NOT EXISTS assets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rel_path TEXT NOT NULL UNIQUE,
            media_type TEXT NOT NULL,
            source TEXT,
            meta_json TEXT,
            created_at TEXT NOT NULL
        );
        "#,
        )
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// M1-1.1：为 `assets` 增加全局 `asset_id`（UUID），并为历史行回填。
fn migrate_assets_asset_id(conn: &Connection) -> Result<(), String> {
    let cols = table_column_names(conn, "assets")?;
    if cols.contains("asset_id") {
        return Ok(());
    }

    conn.execute(
        "ALTER TABLE assets ADD COLUMN asset_id TEXT",
        [],
    )
    .map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT rowid FROM assets WHERE asset_id IS NULL OR trim(asset_id) = ''")
        .map_err(|e| e.to_string())?;
    let rowids: Vec<i64> = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    for rowid in rowids {
        let id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "UPDATE assets SET asset_id = ?1 WHERE rowid = ?2",
            params![id, rowid],
        )
        .map_err(|e| e.to_string())?;
    }

    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_asset_id ON assets(asset_id)",
        [],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

fn table_column_names(conn: &Connection, table: &str) -> Result<HashSet<String>, String> {
    let pragma = format!("PRAGMA table_info({})", table);
    let mut stmt = conn.prepare(&pragma).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|e| e.to_string())?;
    let mut set = HashSet::new();
    for r in rows {
        set.insert(r.map_err(|e| e.to_string())?);
    }
    Ok(set)
}

pub fn insert_run(conn: &Connection, run_id: &str) -> Result<(), String> {
    let ts = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO runs (id, started_at, status) VALUES (?1, ?2, ?3)",
        params![run_id, ts, "queued"],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// 写入 run_events 前确保 runs 行存在（单节点即席运行可能先拿到 run_id 再落库）
pub fn ensure_run_exists(conn: &Connection, run_id: &str) -> Result<(), String> {
    let exists: bool = conn
        .query_row(
            "SELECT 1 FROM runs WHERE id = ?1 LIMIT 1",
            params![run_id],
            |_| Ok(true),
        )
        .unwrap_or(false);
    if exists {
        return Ok(());
    }
    insert_run(conn, run_id)?;
    mark_run_running(conn, run_id)
}

pub fn mark_run_running(conn: &Connection, run_id: &str) -> Result<(), String> {
    conn.execute(
        "UPDATE runs SET status = 'running' WHERE id = ?1",
        params![run_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn finish_run(conn: &Connection, run_id: &str, ok: bool, err: Option<&str>) -> Result<(), String> {
    let ts = chrono::Utc::now().to_rfc3339();
    let status = if ok { "done" } else { "failed" };
    conn.execute(
        "UPDATE runs SET finished_at = ?1, status = ?2, error = ?3 WHERE id = ?4",
        params![ts, status, err, run_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn log_event(
    conn: &Connection,
    run_id: &str,
    node_id: Option<&str>,
    kind: &str,
    payload: &serde_json::Value,
) -> Result<(), String> {
    let ts = chrono::Utc::now().to_rfc3339();
    let payload_str = serde_json::to_string(payload).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO run_events (run_id, ts, node_id, kind, payload_json) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![run_id, ts, node_id, kind, payload_str],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunSummary {
    pub id: String,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub status: String,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunEventRow {
    pub id: i64,
    pub run_id: String,
    pub ts: String,
    pub node_id: Option<String>,
    pub kind: String,
    pub payload_json: String,
}

pub fn list_run_events(conn: &Connection, run_id: &str) -> Result<Vec<RunEventRow>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, run_id, ts, node_id, kind, payload_json
             FROM run_events
             WHERE run_id = ?1
             ORDER BY id ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![run_id], |row| {
            Ok(RunEventRow {
                id: row.get(0)?,
                run_id: row.get(1)?,
                ts: row.get(2)?,
                node_id: row.get(3)?,
                kind: row.get(4)?,
                payload_json: row.get::<_, Option<String>>(5)?.unwrap_or_default(),
            })
        })
        .map_err(|e| e.to_string())?;

    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

pub fn list_runs(conn: &Connection, limit: i64) -> Result<Vec<RunSummary>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, started_at, finished_at, status, error
             FROM runs
             ORDER BY started_at DESC
             LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![limit], |row| {
            Ok(RunSummary {
                id: row.get(0)?,
                started_at: row.get(1)?,
                finished_at: row.get(2)?,
                status: row.get(3)?,
                error: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetSummary {
    pub asset_id: String,
    pub rel_path: String,
    pub media_type: String,
    pub source: Option<String>,
    pub meta_json: Option<String>,
    pub created_at: String,
}

/// `import_media_files` 单文件返回项（M1-1.3）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedMediaItem {
    pub asset_id: String,
    pub rel_path: String,
}

/// 插入或更新素材索引行，保证存在 `asset_id`；冲突时保留已有 `asset_id`。
/// 返回该行最终的 `asset_id`。
pub fn upsert_asset(
    conn: &Connection,
    rel_path: &str,
    media_type: &str,
    source: Option<&str>,
    meta_json: Option<&str>,
) -> Result<String, String> {
    let ts = chrono::Utc::now().to_rfc3339();
    let new_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO assets (rel_path, media_type, source, meta_json, created_at, asset_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(rel_path) DO UPDATE SET
           media_type = excluded.media_type,
           source = excluded.source,
           meta_json = excluded.meta_json,
           asset_id = COALESCE(assets.asset_id, excluded.asset_id)",
        params![rel_path, media_type, source, meta_json, ts, new_id],
    )
    .map_err(|e| e.to_string())?;

    let asset_id: String = conn
        .query_row(
            "SELECT asset_id FROM assets WHERE rel_path = ?1",
            params![rel_path],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(asset_id)
}

fn map_asset_row(row: &rusqlite::Row) -> rusqlite::Result<AssetSummary> {
    Ok(AssetSummary {
        asset_id: row.get(0)?,
        rel_path: row.get(1)?,
        media_type: row.get(2)?,
        source: row.get(3)?,
        meta_json: row.get(4)?,
        created_at: row.get(5)?,
    })
}

/// 按 `asset_id` 查询单条素材索引；不存在则 `Ok(None)`。
pub fn get_asset_by_id(conn: &Connection, asset_id: &str) -> Result<Option<AssetSummary>, String> {
    let sql = "SELECT asset_id, rel_path, media_type, source, meta_json, created_at
               FROM assets WHERE asset_id = ?1 LIMIT 1";
    match conn.query_row(sql, params![asset_id], map_asset_row) {
        Ok(s) => Ok(Some(s)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// 按工程相对路径查询（兼容仅存有 `path` 的节点侧逻辑）。
pub fn get_asset_by_rel_path(conn: &Connection, rel_path: &str) -> Result<Option<AssetSummary>, String> {
    let sql = "SELECT asset_id, rel_path, media_type, source, meta_json, created_at
               FROM assets WHERE rel_path = ?1 LIMIT 1";
    match conn.query_row(sql, params![rel_path], map_asset_row) {
        Ok(s) => Ok(Some(s)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

pub fn list_assets(conn: &Connection, limit: i64) -> Result<Vec<AssetSummary>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT asset_id, rel_path, media_type, source, meta_json, created_at
             FROM assets
             ORDER BY created_at DESC
             LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![limit], map_asset_row)
        .map_err(|e| e.to_string())?;

    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

/// 将素材索引从旧 rel_path 迁移到新 rel_path，保留 asset_id。
pub fn relocate_asset_rel_path(
    conn: &Connection,
    old_rel: &str,
    new_rel: &str,
    media_type: &str,
    source: Option<&str>,
    meta_json: Option<&str>,
) -> Result<Option<String>, String> {
    if old_rel == new_rel {
        return get_asset_by_rel_path(conn, old_rel).map(|row| row.map(|r| r.asset_id));
    }
    if get_asset_by_rel_path(conn, new_rel)?.is_some() {
        return Err(format!("目标路径已有素材索引：{new_rel}"));
    }
    let Some(row) = get_asset_by_rel_path(conn, old_rel)? else {
        return Ok(None);
    };
    conn.execute(
        "UPDATE assets SET rel_path = ?1, media_type = ?2, source = COALESCE(?3, source), meta_json = COALESCE(?4, meta_json) WHERE rel_path = ?5",
        params![new_rel, media_type, source, meta_json, old_rel],
    )
    .map_err(|e| e.to_string())?;
    Ok(Some(row.asset_id))
}

fn job_id_alnum_token(job_id: &str, max_len: usize) -> String {
    job_id
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .take(max_len)
        .collect()
}

/// 查找已落盘的 AI 生成物（必须精确匹配 meta.jobId，避免 Seedance 等同前缀任务误复用首个成片）
pub fn find_gen_asset_by_job_id(
    conn: &Connection,
    media_type: &str,
    job_id: &str,
) -> Result<Option<String>, String> {
    let trimmed = job_id.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }

    // 1) 权威：meta_json.jobId 精确匹配
    let sql_exact = "SELECT rel_path FROM assets
               WHERE media_type = ?1
                 AND rel_path LIKE 'assets/%/gen/%'
                 AND json_extract(meta_json, '$.jobId') = ?2
               ORDER BY created_at DESC
               LIMIT 1";
    match conn.query_row(sql_exact, params![media_type, trimmed], |row| row.get(0)) {
        Ok(rel) => return Ok(Some(rel)),
        Err(rusqlite::Error::QueryReturnedNoRows) => {}
        Err(e) => return Err(e.to_string()),
    }

    // 2) 兼容旧库：路径含完整 job token，且 meta 无 jobId 或与当前 id 一致
    let full_token = job_id_alnum_token(trimmed, 32);
    if full_token.len() < 4 {
        return Ok(None);
    }
    let path_like = format!("%_{full_token}_%");
    let sql_path = "SELECT rel_path FROM assets
               WHERE media_type = ?1
                 AND rel_path LIKE 'assets/%/gen/%'
                 AND rel_path LIKE ?2
                 AND (
                   json_extract(meta_json, '$.jobId') IS NULL
                   OR json_extract(meta_json, '$.jobId') = ?3
                 )
               ORDER BY created_at DESC
               LIMIT 1";
    match conn.query_row(sql_path, params![media_type, path_like, trimmed], |row| row.get(0)) {
        Ok(rel) => Ok(Some(rel)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    /// 模拟迁移前仅有 `assets` 表且无 `asset_id` 列的工程库：打开后应回填 UUID。
    #[test]
    fn migrate_backfills_asset_id_for_legacy_assets_rows() {
        let dir = tempdir().expect("tempdir");
        let root = dir.path();
        let cf = root.join(".canvasflow");
        fs::create_dir_all(&cf).expect("mkdir");
        let db_path = cf.join("runs.db");
        {
            let conn = Connection::open(&db_path).expect("open db");
            conn
                .execute_batch(
                    r#"
                CREATE TABLE assets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    rel_path TEXT NOT NULL UNIQUE,
                    media_type TEXT NOT NULL,
                    source TEXT,
                    meta_json TEXT,
                    created_at TEXT NOT NULL
                );
                INSERT INTO assets (rel_path, media_type, created_at)
                VALUES ('assets/legacy.png', 'image', '2020-01-01T00:00:00Z');
                "#,
                )
                .expect("legacy schema");
        }

        let conn = open_run_db(root).expect("open_run_db migrates");
        let id: String = conn
            .query_row(
                "SELECT asset_id FROM assets WHERE rel_path = 'assets/legacy.png'",
                [],
                |row| row.get(0),
            )
            .expect("row");
        assert_eq!(id.len(), 36);
        assert!(id.contains('-'));
    }

    #[test]
    fn upsert_asset_sets_non_empty_asset_id() {
        let dir = tempdir().expect("tempdir");
        let root = dir.path();
        let conn = open_run_db(root).expect("open_run_db");
        let aid = upsert_asset(
            &conn,
            "assets/x.jpg",
            "image",
            Some("test"),
            None,
        )
        .expect("upsert");
        assert_eq!(aid.len(), 36);
        let listed = list_assets(&conn, 10).expect("list");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].asset_id, aid);
        assert_eq!(listed[0].rel_path, "assets/x.jpg");
    }

    #[test]
    fn get_asset_by_id_roundtrip() {
        let dir = tempdir().expect("tempdir");
        let root = dir.path();
        let conn = open_run_db(root).expect("open_run_db");
        let aid = upsert_asset(&conn, "assets/r.jpg", "image", None, None).expect("upsert");
        let got = get_asset_by_id(&conn, &aid).expect("get").expect("some");
        assert_eq!(got.rel_path, "assets/r.jpg");
        let by_path = get_asset_by_rel_path(&conn, "assets/r.jpg")
            .expect("get path")
            .expect("some");
        assert_eq!(by_path.asset_id, aid);
    }

    #[test]
    fn ensure_run_exists_before_log_event() {
        let dir = tempdir().expect("tempdir");
        let root = dir.path();
        let conn = open_run_db(root).expect("open_run_db");
        let run_id = "adhoc-video-run";
        ensure_run_exists(&conn, run_id).expect("ensure");
        log_event(
            &conn,
            run_id,
            Some("node-1"),
            "agent_phase",
            &serde_json::json!({ "phase": "execute" }),
        )
        .expect("log");
        let events = list_run_events(&conn, run_id).expect("events");
        assert_eq!(events.len(), 1);
    }

    #[test]
    fn find_gen_asset_does_not_reuse_same_8char_prefix_job() {
        let dir = tempdir().expect("tempdir");
        let conn = open_run_db(dir.path()).expect("db");
        upsert_asset(
            &conn,
            "assets/video/gen/seedance/seedance_t2v_20260605_cgt20250_node_a_abcd.mp4",
            "video",
            Some("seedance"),
            Some(r#"{"jobId":"cgt-20250605-task-aaaa"}"#),
        )
        .expect("upsert");
        let found = find_gen_asset_by_job_id(&conn, "video", "cgt-20250605-task-bbbb")
            .expect("find");
        assert!(found.is_none(), "must not return first job video for different job id");
        let own = find_gen_asset_by_job_id(&conn, "video", "cgt-20250605-task-aaaa")
            .expect("find own")
            .expect("some");
        assert!(own.contains("cgt20250"));
    }

    #[test]
    fn find_gen_asset_does_not_reuse_8char_path_when_meta_job_id_missing() {
        let dir = tempdir().expect("tempdir");
        let conn = open_run_db(dir.path()).expect("db");
        upsert_asset(
            &conn,
            "assets/video/gen/seedance/seedance_t2v_20260605_cgt20250_node_a_abcd.mp4",
            "video",
            Some("seedance"),
            None,
        )
        .expect("upsert");
        let found = find_gen_asset_by_job_id(&conn, "video", "cgt-20250605-task-bbbb")
            .expect("find");
        assert!(
            found.is_none(),
            "legacy path with 8-char token must not match a different job"
        );
    }

    #[test]
    fn find_gen_asset_by_job_token_in_path() {
        let dir = tempdir().expect("tempdir");
        let conn = open_run_db(dir.path()).expect("db");
        upsert_asset(
            &conn,
            "assets/video/gen/dreamina/dreamina_t2v_20260530_f64d4c23_node_na_abcd.mp4",
            "video",
            Some("dreamina"),
            Some(r#"{"jobId":"f64d4c23-d334-415a-bb2f-0383ee8544aa"}"#),
        )
        .expect("upsert");
        let found = find_gen_asset_by_job_id(&conn, "video", "f64d4c23-d334-415a-bb2f-0383ee8544aa")
            .expect("find")
            .expect("some");
        assert!(found.contains("f64d4c23"));
    }
}
