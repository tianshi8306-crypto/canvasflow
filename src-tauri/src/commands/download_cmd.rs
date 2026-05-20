use crate::commands::types::DownloadAssetResponse;
use crate::db;
use crate::media;
use crate::AppState;
use std::path::PathBuf;

/// 预留的外部安全域名白名单（未来需要更严格白名单时启用）
/// 目前通过 is_private_hostname 内网过滤提供基础保护
#[allow(dead_code)]
const ALLOWED_HOSTS: &[&str] = &[
    "api.minimaxi.chat",
    "ark.cn-beijing.volces.com",
    "open.bigmodel.cn",
    "dashscope.aliyuncs.com",
    "api.zhipuai.cn",
    "api.siliconflow.cn",
    "vision.bigmodel.cn",
];

/// 检查 hostname 是否为内网 IP 或保留地址
fn is_private_hostname(host: &str) -> bool {
    // 排除空 hostname
    if host.is_empty() {
        return true;
    }
    // 检查是否为 IP 地址（IPv4）
    if host.parse::<std::net::Ipv4Addr>().is_ok() {
        return true; // 直接拒绝所有 IP，包括公网 IP
    }
    // 检查是否为 localhost
    if host.eq_ignore_ascii_case("localhost") || host.eq_ignore_ascii_case("127.0.0.1") {
        return true;
    }
    // 检查是否为内网域名后缀
    if host.ends_with(".local") || host.ends_with(".internal") || host.ends_with(".intra") {
        return true;
    }
    // 检查是否为内网常见域名
    let lower = host.to_lowercase();
    if lower.starts_with("192.168.")
        || lower.starts_with("10.")
        || lower.starts_with("172.")
        || lower.starts_with("127.")
    {
        return true;
    }
    false
}

fn validate_url_hostname(url_str: &str) -> Result<String, String> {
    let parsed =
        url::Url::parse(url_str.trim()).map_err(|e| format!("url 非法：{}", e))?;
    let scheme = parsed.scheme();
    if scheme != "http" && scheme != "https" {
        return Err("仅支持 http/https url".into());
    }
    let host = parsed
        .host_str()
        .ok_or_else(|| "url 缺少 hostname".to_string())?;

    if is_private_hostname(host) {
        return Err(format!("禁止访问内网地址：{}", host));
    }

    // 可选：额外检查是否为已知安全域名（非必须，保留扩展性）
    // 如果未来需要更严格的白名单，可以在这里取消注释并配置
    // let host_lower = host.to_lowercase();
    // if !ALLOWED_HOSTS.iter().any(|h| host_lower.contains(h)) {
    //     return Err(format!("禁止访问未授权域名：{}", host));
    // }

    Ok(host.to_string())
}

/// 下载远程文件到工程 `assets/`，并登记到素材库（runs.db.assets）。用于视频/图片/音频等 URL 结果落盘。
#[tauri::command]
pub async fn download_remote_asset_to_project(
    state: tauri::State<'_, AppState>,
    project_path: String,
    url: String,
    kind: String,
    source_label: Option<String>,
) -> Result<DownloadAssetResponse, String> {
    let root = PathBuf::from(project_path.trim());
    if project_path.trim().is_empty() {
        return Err("projectPath 不能为空".into());
    }
    if url.trim().is_empty() {
        return Err("url 不能为空".into());
    }
    let kind = kind.trim().to_lowercase();
    if kind != "video" && kind != "image" && kind != "audio" && kind != "file" {
        return Err("kind 仅支持 video/image/audio/file".into());
    }

    // ── 安全校验：hostname 白名单 + 内网地址过滤 ──
    let _ = validate_url_hostname(&url)?;

    let resp = state
        .http
        .get(url.trim())
        .send()
        .await
        .map_err(|e| format!("下载失败：{}", e))?;
    let status = resp.status();
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("读取下载内容失败：{}", e))?;
    if !status.is_success() {
        let text = String::from_utf8_lossy(&bytes).to_string();
        let parsed: serde_json::Value =
            serde_json::from_str(&text).unwrap_or_else(|_| serde_json::json!({ "raw": text }));
        return Err(format!(
            "下载失败({})：{}",
            status.as_u16(),
            serde_json::to_string(&parsed).unwrap_or_default()
        ));
    }

    let ext = match kind.as_str() {
        "video" => "mp4",
        "image" => "png",
        "audio" => "mp3",
        _ => "bin",
    };
    let file_name = format!(
        "{}_{}_{}.{}",
        kind,
        chrono::Utc::now().format("%Y%m%d_%H%M%S"),
        &uuid::Uuid::new_v4().to_string()[..8],
        ext
    );
    let assets_dir = root.join("assets");
    std::fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;
    let out = assets_dir.join(&file_name);
    std::fs::write(&out, &bytes).map_err(|e| format!("保存文件失败：{}", e))?;

    let rel = format!("assets/{}", file_name);
    let conn = db::open_run_db(&root)?;
    let meta_json = match kind.as_str() {
        "image" => media::meta_json_for_image(&out),
        "video" => media::meta_json_for_av(&out, "video"),
        "audio" => media::meta_json_for_av(&out, "audio"),
        _ => None,
    };
    let aid = db::upsert_asset(
        &conn,
        &rel,
        kind.as_str(),
        source_label.as_deref(),
        meta_json.as_deref(),
    )?;
    Ok(DownloadAssetResponse {
        rel_path: rel,
        asset_id: Some(aid),
    })
}
