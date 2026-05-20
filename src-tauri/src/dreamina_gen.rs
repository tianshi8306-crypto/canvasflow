//! 即梦 CLI 图片/视频生成（submit + query_result 轮询）

use crate::commands::types::{VideoGenerationStartRequest, VideoJobSnapshot};
use crate::db;
use crate::dreamina_cli::{ensure_command_path, run_dreamina_command, DreaminaCliState};
use crate::media;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::thread;
use std::time::Duration;

const IMAGE_POLL_MAX: u32 = 80;
const IMAGE_POLL_INTERVAL_MS: u64 = 2500;
const VIDEO_POLL_INTERVAL_MS: u64 = 3000;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_pixel_size_to_dreamina_resolution_tier() {
        assert_eq!(
            normalize_resolution_type(Some("2048x1152")).as_deref(),
            Some("2k")
        );
        assert_eq!(normalize_resolution_type(Some("2K")).as_deref(), Some("2k"));
        assert_eq!(normalize_resolution_type(Some("1024x1024")).as_deref(), Some("1k"));
    }

    #[test]
    fn maps_video_panel_resolution_to_cli() {
        assert_eq!(
            normalize_video_resolution(Some("720P")).as_deref(),
            Some("720p")
        );
        assert_eq!(
            normalize_video_resolution(Some("1080P")).as_deref(),
            Some("1080p")
        );
    }

    #[test]
    fn skips_smart_duration_for_cli() {
        assert_eq!(normalize_dreamina_duration(Some(-1)), None);
        assert_eq!(normalize_dreamina_duration(Some(5)), Some(5));
    }
}

pub fn is_dreamina_model(model: &str) -> bool {
    let m = model.trim().to_lowercase();
    m.starts_with("dreamina/") || m == "dreamina"
}

fn dreamina_model_version(model: &str) -> Option<String> {
    let rest = model.trim().strip_prefix("dreamina/")?;
    let lower = rest.to_lowercase();
    if matches!(
        lower.as_str(),
        "text2image"
            | "image2image"
            | "text2video"
            | "image2video"
            | "frames2video"
            | "multimodal2video"
    ) {
        return None;
    }
    if rest.is_empty() {
        None
    } else {
        Some(rest.to_string())
    }
}

/// 即梦 CLI `--resolution_type` 仅接受 1k / 2k / 4k；画布 HTTP 路径会传 `2048x1152`。
fn normalize_resolution_type(resolution: Option<&str>) -> Option<String> {
    let r = resolution?.trim();
    if r.is_empty() {
        return None;
    }
    let lower = r.to_lowercase();
    if matches!(lower.as_str(), "1k" | "2k" | "4k") {
        return Some(lower);
    }
    if let Some((w, h)) = parse_pixel_size(r) {
        let short = w.min(h);
        if short <= 1024 {
            return Some("1k".into());
        }
        if short <= 2048 {
            return Some("2k".into());
        }
        return Some("4k".into());
    }
    None
}

fn parse_pixel_size(raw: &str) -> Option<(u32, u32)> {
    let mut parts = raw.split('x');
    let w: u32 = parts.next()?.trim().parse().ok()?;
    let h: u32 = parts.next()?.trim().parse().ok()?;
    if w > 0 && h > 0 {
        Some((w, h))
    } else {
        None
    }
}

fn trim_cli_output_tail(output: &str, max_lines: usize) -> String {
    let lines: Vec<&str> = output
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .collect();
    if lines.is_empty() {
        return String::new();
    }
    let start = lines.len().saturating_sub(max_lines);
    lines[start..].join("\n")
}

fn format_cli_failure(context: &str, output: &str) -> String {
    let tail = trim_cli_output_tail(output, 12);
    if tail.is_empty() {
        context.to_string()
    } else {
        format!("{context}\n{tail}")
    }
}

fn normalize_ratio(aspect: Option<&str>) -> Option<String> {
    let a = aspect?.trim();
    if a.is_empty() || a.eq_ignore_ascii_case("auto") {
        return None;
    }
    Some(a.to_string())
}

/// 视频节点输出 `480P`/`720P`/`1080P`，即梦 CLI 与火山路径一致使用小写 `480p` 等。
fn normalize_video_resolution(resolution: Option<&str>) -> Option<String> {
    let r = resolution?.trim();
    if r.is_empty() {
        return None;
    }
    let lower = r.to_lowercase();
    if matches!(lower.as_str(), "480p" | "720p" | "1080p") {
        return Some(lower);
    }
    None
}

/// 智能时长等为 -1，不传 --duration，由 CLI 默认处理。
fn normalize_dreamina_duration(duration: Option<i64>) -> Option<i64> {
    let d = duration?;
    if d <= 0 {
        return None;
    }
    Some(d)
}

fn parse_json_from_output(text: &str) -> Value {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Value::Null;
    }
    if let Ok(v) = serde_json::from_str::<Value>(trimmed) {
        return v;
    }
    for line in trimmed.lines().rev() {
        let s = line.trim();
        if s.starts_with('{') || s.starts_with('[') {
            if let Ok(v) = serde_json::from_str(s) {
                return v;
            }
        }
    }
    Value::Null
}

fn iter_payload_dicts(data: &Value) -> Vec<&Value> {
    let mut out = Vec::new();
    let mut stack = vec![data];
    let mut seen = std::collections::HashSet::new();
    while let Some(current) = stack.pop() {
        if let Value::Object(map) = current {
            let id = current as *const Value as usize;
            if !seen.insert(id) {
                continue;
            }
            out.push(current);
            for key in ["data", "result", "queryResult", "listTask", "task", "tasks"] {
                if let Some(nested) = map.get(key) {
                    stack.push(nested);
                }
            }
        } else if let Value::Array(arr) = current {
            for item in arr {
                stack.push(item);
            }
        }
    }
    out
}

fn extract_submit_id(data: &Value) -> Option<String> {
    for nested in iter_payload_dicts(data) {
        if let Value::Object(map) = nested {
            for key in ["submit_id", "submitId"] {
                if let Some(Value::String(s)) = map.get(key) {
                    let v = s.trim();
                    if !v.is_empty() {
                        return Some(v.to_string());
                    }
                }
            }
        }
    }
    None
}

fn normalize_gen_status(value: &str) -> String {
    let s = value.trim().to_lowercase();
    if matches!(
        s.as_str(),
        "querying" | "running" | "pending" | "processing" | "queued"
    ) {
        "querying".into()
    } else if matches!(s.as_str(), "success" | "succeeded" | "completed" | "done") {
        "success".into()
    } else if matches!(s.as_str(), "fail" | "failed" | "error") {
        "failed".into()
    } else if s.is_empty() {
        "unknown".into()
    } else {
        s
    }
}

fn extract_gen_status(data: &Value, fallback: &str) -> String {
    for nested in iter_payload_dicts(data) {
        if let Value::Object(map) = nested {
            for key in ["gen_status", "genStatus", "status"] {
                if let Some(Value::String(s)) = map.get(key) {
                    let v = s.trim();
                    if !v.is_empty() {
                        return normalize_gen_status(v);
                    }
                }
            }
        }
    }
    normalize_gen_status(fallback)
}

fn extract_fail_reason(data: &Value) -> Option<String> {
    for nested in iter_payload_dicts(data) {
        if let Value::Object(map) = nested {
            for key in [
                "fail_reason",
                "failReason",
                "message",
                "error",
                "err_msg",
            ] {
                if let Some(Value::String(s)) = map.get(key) {
                    let v = s.trim();
                    if !v.is_empty() {
                        return Some(v.to_string());
                    }
                }
            }
        }
    }
    None
}

#[derive(Debug, Clone)]
struct MediaOutput {
    url: Option<String>,
    local_path: Option<PathBuf>,
}

fn extract_outputs(data: &Value, download_dir: Option<&Path>) -> Vec<MediaOutput> {
    let mut outputs = Vec::new();
    let mut seen = std::collections::HashSet::new();

    let mut push = |url: Option<String>, local: Option<PathBuf>| {
        let key = format!(
            "{}|{}",
            url.as_deref().unwrap_or(""),
            local
                .as_ref()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default()
        );
        if key == "|" || !seen.insert(key) {
            return;
        }
        outputs.push(MediaOutput {
            url,
            local_path: local,
        });
    };

    fn visit(value: &Value, depth: usize, push: &mut dyn FnMut(Option<String>, Option<PathBuf>)) {
        if depth > 8 {
            return;
        }
        match value {
            Value::String(s) => {
                let t = s.trim();
                if t.starts_with("http://") || t.starts_with("https://") {
                    push(Some(t.to_string()), None);
                }
            }
            Value::Array(arr) => {
                for item in arr {
                    visit(item, depth + 1, push);
                }
            }
            Value::Object(map) => {
                let url = ["url", "image_url", "video_url", "cover_url", "coverUrl", "src"]
                    .iter()
                    .find_map(|k| map.get(*k).and_then(|v| v.as_str()))
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty());
                let local = ["local_path", "localPath", "path", "file_path", "filePath"]
                    .iter()
                    .find_map(|k| map.get(*k).and_then(|v| v.as_str()))
                    .map(|s| PathBuf::from(s.trim()))
                    .filter(|p| !p.as_os_str().is_empty());
                if url.is_some() || local.is_some() {
                    push(url, local);
                }
                for (key, child) in map {
                    let lower = key.to_lowercase();
                    if lower.contains("input") || lower.contains("reference") || lower.contains("prompt")
                    {
                        continue;
                    }
                    if lower.contains("output")
                        || lower.contains("result")
                        || lower.contains("image")
                        || lower.contains("video")
                        || lower.contains("media")
                        || lower.contains("file")
                        || lower.contains("url")
                    {
                        visit(child, depth + 1, push);
                    }
                }
            }
            _ => {}
        }
    }

    visit(data, 0, &mut push);

    if let Some(dir) = download_dir {
        if dir.is_dir() {
            walk_media_files(dir, &mut push);
        }
    }

    outputs
}

fn walk_media_files(dir: &Path, push: &mut dyn FnMut(Option<String>, Option<PathBuf>)) {
    let Ok(read) = fs::read_dir(dir) else {
        return;
    };
    let mut entries: Vec<_> = read.filter_map(|e| e.ok()).collect();
    entries.sort_by_key(|e| e.file_name());
    for entry in entries {
        let path = entry.path();
        if path.is_file() {
            push(None, Some(path));
        } else if path.is_dir() {
            walk_media_files(&path, push);
        }
    }
}

fn make_temp_input_dir() -> Result<PathBuf, String> {
    let dir = dreamina_download_root()?
        .join("inputs")
        .join(uuid::Uuid::new_v4().to_string());
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn dreamina_download_root() -> Result<PathBuf, String> {
    #[cfg(windows)]
    {
        let base = std::env::var("APPDATA")
            .map(PathBuf::from)
            .map_err(|_| "无法读取 APPDATA".to_string())?;
        let dir = base.join("canvasflow").join("dreamina").join("downloads");
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        return Ok(dir);
    }
    #[cfg(not(windows))]
    {
        let home = std::env::var("HOME")
            .map(PathBuf::from)
            .map_err(|_| "无法读取 HOME".to_string())?;
        let dir = home
            .join(".config")
            .join("canvasflow")
            .join("dreamina")
            .join("downloads");
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        Ok(dir)
    }
}

fn build_download_dir(task_type: &str, submit_id: &str) -> PathBuf {
    dreamina_download_root()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join(task_type)
        .join(submit_id)
}

fn is_transient_query_error(output: &str) -> bool {
    let text = output.to_lowercase();
    if text.is_empty() {
        return false;
    }
    [
        "timeout", "timed out", "超时", "网络", "network", "connect", "connection", "socket",
        "econn", "enotfound", "temporary", "暂时", "busy", "503", "502", "504", "429",
    ]
    .iter()
    .any(|h| text.contains(h))
}

fn to_query_phase(gen_status: &str, outputs: &[MediaOutput]) -> &'static str {
    if matches!(gen_status, "querying" | "running" | "pending" | "processing" | "queued") {
        return "pending";
    }
    if gen_status == "success" || !outputs.is_empty() {
        return "success";
    }
    if gen_status == "failed" {
        return "failed";
    }
    "pending"
}

fn ensure_logged_in(dreamina: &DreaminaCliState) -> Result<(), String> {
    let status = dreamina.get_status(true)?;
    if !status.logged_in {
        return Err("即梦未登录，请先在设置中完成即梦授权".into());
    }
    Ok(())
}

fn submit_task(
    command_path: &str,
    subcommand: &str,
    args: Vec<String>,
) -> Result<String, String> {
    let mut cli_args: Vec<&str> = vec![subcommand];
    for a in &args {
        cli_args.push(a.as_str());
    }
    cli_args.push("--poll");
    cli_args.push("0");

    let result = run_dreamina_command(command_path, &cli_args, 60)?;
    let data = parse_json_from_output(&result.output);
    let submit_id = extract_submit_id(&data);
    let gen_status = extract_gen_status(&data, if result.ok { "success" } else { "failed" });
    let fail_reason = extract_fail_reason(&data)
        .or_else(|| {
            if result.output.trim().is_empty() {
                None
            } else {
                Some(result.output.trim().to_string())
            }
        })
        .unwrap_or_else(|| "即梦提交失败".to_string());

    if let Some(id) = submit_id {
        if gen_status != "failed" {
            return Ok(id);
        }
    }

    if !result.ok || gen_status == "failed" {
        return Err(format_cli_failure(
            &fail_reason,
            &result.output,
        ));
    }
    Err(format_cli_failure(&fail_reason, &result.output))
}

struct QueryResult {
    phase: &'static str,
    outputs: Vec<MediaOutput>,
    fail_reason: Option<String>,
}

fn query_once(
    command_path: &str,
    submit_id: &str,
    task_type: &str,
    download: bool,
) -> Result<QueryResult, String> {
    let download_dir = build_download_dir(task_type, submit_id);
    if download {
        let _ = fs::create_dir_all(&download_dir);
    }

    let mut args = vec![
        "query_result".to_string(),
        "--submit_id".to_string(),
        submit_id.to_string(),
    ];
    if download {
        args.push("--download_dir".to_string());
        args.push(download_dir.to_string_lossy().into_owned());
    }

    let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let result = run_dreamina_command(command_path, &arg_refs, 45)?;
    let output_text = result.output.trim();
    let data = parse_json_from_output(output_text);

    if data.is_null() && !result.ok {
        if is_transient_query_error(output_text) {
            return Ok(QueryResult {
                phase: "pending",
                outputs: vec![],
                fail_reason: None,
            });
        }
        return Ok(QueryResult {
            phase: "failed",
            outputs: vec![],
            fail_reason: Some(if output_text.is_empty() {
                "查询失败".into()
            } else {
                output_text.to_string()
            }),
        });
    }

    let gen_status = extract_gen_status(&data, if result.ok { "success" } else { "failed" });
    let outputs = extract_outputs(
        &data,
        if download {
            Some(download_dir.as_path())
        } else {
            None
        },
    );
    let phase = to_query_phase(&gen_status, &outputs);
    let fail_reason = extract_fail_reason(&data);
    Ok(QueryResult {
        phase,
        outputs,
        fail_reason,
    })
}

fn resolve_media_input(
    project_path: &Path,
    http: &reqwest::Client,
    temp_dir: &Path,
    raw: &str,
) -> Result<PathBuf, String> {
    let value = raw.trim();
    if value.is_empty() {
        return Err("输入素材为空".into());
    }
    if value.starts_with("data:") {
        return decode_data_url_to_file(value, temp_dir);
    }
    if value.starts_with("http://") || value.starts_with("https://") {
        return block_on_download(http, value, temp_dir);
    }
    let abs = if Path::new(value).is_absolute() {
        PathBuf::from(value)
    } else {
        project_path.join(value)
    };
    if abs.is_file() {
        return Ok(abs);
    }
    Err(format!("输入素材不存在：{value}"))
}

fn decode_data_url_to_file(data_url: &str, temp_dir: &Path) -> Result<PathBuf, String> {
    let rest = data_url
        .strip_prefix("data:")
        .ok_or_else(|| "无效的 data URL".to_string())?;
    let (meta, payload) = rest
        .split_once(',')
        .ok_or_else(|| "无效的 data URL".to_string())?;
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(payload.trim())
        .map_err(|e| format!("解析 data URL 失败：{e}"))?;
    let ext = if meta.contains("png") {
        ".png"
    } else if meta.contains("jpeg") || meta.contains("jpg") {
        ".jpg"
    } else if meta.contains("webp") {
        ".webp"
    } else if meta.contains("mp4") {
        ".mp4"
    } else if meta.contains("mpeg") || meta.contains("mp3") {
        ".mp3"
    } else {
        ".bin"
    };
    let path = temp_dir.join(format!("input_{}{}", uuid::Uuid::new_v4(), ext));
    fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(path)
}

fn block_on_download(http: &reqwest::Client, url: &str, temp_dir: &Path) -> Result<PathBuf, String> {
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|e| e.to_string())?;
    rt.block_on(async {
        let bytes = http
            .get(url)
            .send()
            .await
            .map_err(|e| format!("下载素材失败：{e}"))?
            .error_for_status()
            .map_err(|e| format!("下载素材失败：{e}"))?
            .bytes()
            .await
            .map_err(|e| e.to_string())?;
        let ext = Path::new(url)
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| format!(".{e}"))
            .unwrap_or_else(|| ".bin".into());
        let path = temp_dir.join(format!("dl_{}{}", uuid::Uuid::new_v4(), ext));
        fs::write(&path, &bytes).map_err(|e| e.to_string())?;
        Ok(path)
    })
}

fn pick_first_output(outputs: &[MediaOutput], prefer_video: bool) -> Option<PathBuf> {
    let exts_video = [".mp4", ".mov", ".webm", ".mkv"];
    let exts_image = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
    let pick = |exts: &[&str]| {
        outputs.iter().find_map(|o| {
            o.local_path.as_ref().and_then(|p| {
                let s = p.to_string_lossy().to_lowercase();
                if exts.iter().any(|e| s.ends_with(e)) {
                    Some(p.clone())
                } else {
                    None
                }
            })
        })
    };
    if prefer_video {
        pick(&exts_video)
            .or_else(|| pick(&exts_image))
            .or_else(|| outputs.first().and_then(|o| o.local_path.clone()))
    } else {
        pick(&exts_image)
            .or_else(|| pick(&exts_video))
            .or_else(|| outputs.first().and_then(|o| o.local_path.clone()))
    }
}

fn copy_to_project_asset(
    project_path: &Path,
    source: &Path,
    kind: &str,
) -> Result<String, String> {
    let assets_dir = project_path.join("assets");
    fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;
    let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or(if kind == "video" { "mp4" } else { "png" });
    let prefix = if kind == "video" { "dreamina_vid" } else { "dreamina_img" };
    let file_name = format!(
        "{}_{}.{}",
        prefix,
        chrono::Utc::now().format("%Y%m%d_%H%M%S"),
        ext
    );
    let dest = assets_dir.join(&file_name);
    fs::copy(source, &dest).map_err(|e| format!("复制生成结果失败：{e}"))?;
    let rel = format!("assets/{file_name}");
    let conn = db::open_run_db(project_path)?;
    let meta = if kind == "video" {
        media::meta_json_for_av(&dest, "video")
    } else {
        media::meta_json_for_image(&dest)
    };
    let _ = db::upsert_asset(&conn, &rel, kind, Some("dreamina"), meta.as_deref())?;
    Ok(rel)
}

/// 即梦文生图 / 图生图：提交后轮询直至完成，返回工程相对路径。
pub async fn generate_image_via_cli(
    dreamina: &DreaminaCliState,
    http: &reqwest::Client,
    project_path: &str,
    prompt: &str,
    model: &str,
    task: Option<&str>,
    reference_image_paths: Option<Vec<String>>,
    aspect: Option<String>,
    resolution: Option<String>,
) -> Result<String, String> {
    ensure_logged_in(dreamina)?;
    let command_path = ensure_command_path(http)?;
    let project = PathBuf::from(project_path);
    let temp_path = make_temp_input_dir()?;

    let task_name = task.unwrap_or("text_to_image");
    let refs = reference_image_paths.unwrap_or_default();
    let needs_ref = matches!(
        task_name,
        "image_to_image" | "multi_ref_fusion" | "image_edit"
    );

    let subcommand = if needs_ref && !refs.is_empty() {
        "image2image"
    } else {
        "text2image"
    };

    if subcommand == "image2image" && refs.is_empty() {
        return Err("图生图需要至少一张参考图".into());
    }

    let mut args: Vec<String> = vec!["--prompt".into(), prompt.trim().to_string()];
    if let Some(r) = normalize_ratio(aspect.as_deref()) {
        args.push("--ratio".into());
        args.push(r);
    }
    if let Some(rt) = normalize_resolution_type(resolution.as_deref()) {
        args.push("--resolution_type".into());
        args.push(rt);
    }
    if let Some(ver) = dreamina_model_version(model) {
        args.push("--model_version".into());
        args.push(ver);
    }

    if subcommand == "image2image" {
        let mut paths = Vec::new();
        for rel in refs.iter().take(10) {
            paths.push(
                resolve_media_input(&project, http, &temp_path, rel)?
                    .to_string_lossy()
                    .into_owned(),
            );
        }
        args.push("--images".into());
        args.push(paths.join(","));
    }

    let task_type = subcommand.to_string();
    let submit_id = submit_task(&command_path, subcommand, args)?;

    let mut downloaded = false;
    for attempt in 0..IMAGE_POLL_MAX {
        if attempt > 0 {
            thread::sleep(Duration::from_millis(IMAGE_POLL_INTERVAL_MS));
        }
        let q = query_once(&command_path, &submit_id, &task_type, !downloaded)?;
        if q.phase == "pending" {
            continue;
        }
        if q.phase == "failed" {
            return Err(
                q.fail_reason
                    .unwrap_or_else(|| "即梦图片生成失败".into()),
            );
        }
        downloaded = true;
        if let Some(local) = pick_first_output(&q.outputs, false) {
            return copy_to_project_asset(&project, &local, "image");
        }
        if attempt + 1 >= IMAGE_POLL_MAX {
            break;
        }
    }
    Err("即梦图片生成超时，请稍后在即梦中查看任务状态".into())
}

fn resolve_video_subcommand(workflow: &str) -> Result<&'static str, String> {
    match workflow {
        "text_to_video" => Ok("text2video"),
        "image_to_video" => Ok("image2video"),
        "first_last_frame" => Ok("frames2video"),
        "multimodal_reference" | "image_reference" | "video_reference" => Ok("multimodal2video"),
        other => Err(format!("即梦暂不支持该视频工作流：{other}")),
    }
}

fn read_output_numbers(output: &Value) -> (Option<i64>, Option<String>, Option<String>) {
    let Some(obj) = output.as_object() else {
        return (None, None, None);
    };
    let duration = obj
        .get("durationSec")
        .and_then(|v| v.as_i64())
        .or_else(|| obj.get("duration").and_then(|v| v.as_i64()));
    let resolution = obj
        .get("resolution")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let aspect = obj
        .get("aspectRatio")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    (duration, resolution, aspect)
}

/// 提交即梦视频任务，返回 submitId（作为 jobId）。
pub async fn submit_video_via_cli(
    dreamina: &DreaminaCliState,
    http: &reqwest::Client,
    req: &VideoGenerationStartRequest,
) -> Result<String, String> {
    ensure_logged_in(dreamina)?;
    let command_path = ensure_command_path(http)?;
    let project = PathBuf::from(&req.project_path);
    let temp_path = make_temp_input_dir()?;

    let workflow = req.payload.workflow.trim();
    let subcommand = resolve_video_subcommand(workflow)?;
    let prompt = req.payload.prompt.trim();
    let (duration_raw, video_resolution_raw, ratio) = read_output_numbers(&req.payload.output);
    let duration = normalize_dreamina_duration(duration_raw);
    let video_resolution = normalize_video_resolution(video_resolution_raw.as_deref());

    let mut args: Vec<String> = Vec::new();

    match subcommand {
        "text2video" => {
            if prompt.is_empty() {
                return Err("视频提示词不能为空".into());
            }
            args.push("--prompt".into());
            args.push(prompt.to_string());
            if let Some(r) = normalize_ratio(ratio.as_deref()) {
                args.push("--ratio".into());
                args.push(r);
            }
        }
        "image2video" => {
            if prompt.is_empty() {
                return Err("视频提示词不能为空".into());
            }
            let images = req.payload.reference_image_paths.as_ref();
            let first = images
                .and_then(|v| v.first())
                .ok_or_else(|| "图生视频需要至少一张参考图".to_string())?;
            let image_path = resolve_media_input(&project, http, &temp_path, first)?;
            args.push("--image".into());
            args.push(image_path.to_string_lossy().into_owned());
            args.push("--prompt".into());
            args.push(prompt.to_string());
        }
        "frames2video" => {
            if prompt.is_empty() {
                return Err("视频提示词不能为空".into());
            }
            let images = req
                .payload
                .reference_image_paths
                .as_ref()
                .filter(|v| v.len() >= 2)
                .ok_or_else(|| "首尾帧需要至少两张参考图".to_string())?;
            let first = resolve_media_input(&project, http, &temp_path, &images[0])?;
            let last = resolve_media_input(&project, http, &temp_path, &images[1])?;
            args.push("--first".into());
            args.push(first.to_string_lossy().into_owned());
            args.push("--last".into());
            args.push(last.to_string_lossy().into_owned());
            args.push("--prompt".into());
            args.push(prompt.to_string());
        }
        "multimodal2video" => {
            let mut has_media = false;
            if let Some(images) = &req.payload.reference_image_paths {
                for raw in images.iter().take(9) {
                    let p = resolve_media_input(&project, http, &temp_path, raw)?;
                    args.push("--image".into());
                    args.push(p.to_string_lossy().into_owned());
                    has_media = true;
                }
            }
            if let Some(videos) = &req.payload.reference_video_paths {
                for raw in videos.iter().take(3) {
                    let p = resolve_media_input(&project, http, &temp_path, raw)?;
                    args.push("--video".into());
                    args.push(p.to_string_lossy().into_owned());
                    has_media = true;
                }
            }
            if let Some(audios) = &req.payload.reference_audio_paths {
                for raw in audios.iter().take(3) {
                    let p = resolve_media_input(&project, http, &temp_path, raw)?;
                    args.push("--audio".into());
                    args.push(p.to_string_lossy().into_owned());
                }
            }
            if !has_media {
                return Err("全能参考至少需要 1 个图片或视频参考".into());
            }
            if !prompt.is_empty() {
                args.push("--prompt".into());
                args.push(prompt.to_string());
            }
            if let Some(r) = normalize_ratio(ratio.as_deref()) {
                args.push("--ratio".into());
                args.push(r);
            }
        }
        _ => return Err("未知的即梦视频子命令".into()),
    }

    if let Some(d) = duration {
        args.push("--duration".into());
        args.push(d.to_string());
    }
    if let Some(vr) = video_resolution {
        args.push("--video_resolution".into());
        args.push(vr);
    }
    if let Some(ver) = dreamina_model_version(&req.payload.model_id) {
        args.push("--model_version".into());
        args.push(ver);
    }

    submit_task(&command_path, subcommand, args)
}

/// 轮询即梦视频任务；映射为 VideoJobSnapshot 状态。
pub async fn poll_video_via_cli(
    http: &reqwest::Client,
    submit_id: &str,
    project_path: &str,
    model_id: &str,
    workflow: &str,
) -> Result<VideoJobSnapshot, String> {
    let command_path = ensure_command_path(http)?;
    let task_type = resolve_video_subcommand(workflow).unwrap_or("text2video");
    let q = query_once(&command_path, submit_id, task_type, true)?;

    let id = submit_id.to_string();
    let model_id = model_id.to_string();

    if q.phase == "pending" {
        return Ok(VideoJobSnapshot {
            id,
            status: "running".into(),
            progress: Some(0.5),
            error: None,
            model_id,
            result_rel_path: None,
        });
    }

    if q.phase == "failed" {
        return Ok(VideoJobSnapshot {
            id,
            status: "failed".into(),
            progress: Some(1.0),
            error: Some(q.fail_reason.unwrap_or_else(|| "即梦视频生成失败".into())),
            model_id,
            result_rel_path: None,
        });
    }

    if let Some(local) = pick_first_output(&q.outputs, true) {
        let rel = copy_to_project_asset(Path::new(project_path), &local, "video")?;
        return Ok(VideoJobSnapshot {
            id,
            status: "succeeded".into(),
            progress: Some(1.0),
            error: None,
            model_id,
            result_rel_path: Some(rel),
        });
    }

    Ok(VideoJobSnapshot {
        id,
        status: "running".into(),
        progress: Some(0.7),
        error: None,
        model_id,
        result_rel_path: None,
    })
}
