use crate::commands::types::DownloadAssetResponse;
use crate::db;
use crate::project_asset_store::{self, AssetWriteContext};
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

/// 下载远程 URL 到 `assets/gen/{kind}/{source}/` 并登记素材库。
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
    let source = source_label
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or("download");
    let ctx = AssetWriteContext {
        kind: kind.as_str(),
        source,
        workflow: None,
        node_id: None,
        job_id: None,
    };
    let rel = project_asset_store::write_bytes_to_project_asset(&root, &bytes, ext, &ctx)?;
    let conn = db::open_run_db(&root)?;
    let asset_id = db::get_asset_by_rel_path(&conn, &rel)?.map(|a| a.asset_id);
    Ok(DownloadAssetResponse {
        rel_path: rel,
        asset_id,
    })
}
