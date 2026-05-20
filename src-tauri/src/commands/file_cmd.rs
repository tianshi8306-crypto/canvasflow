//! 文件操作命令

use base64::{engine::general_purpose::STANDARD, Engine};

/// 读取文件并返回 base64 编码（自动校验大小上限）
/// - 图片 ≤30MB，视频 ≤50MB，音频 ≤15MB
/// 超过上限时返回错误，不读取文件内容
#[tauri::command]
pub fn read_file_as_base64(path: String) -> Result<String, String> {
    let bytes = std::fs::read(&path).map_err(|e| format!("读取文件失败 {}：{}", path, e))?;
    let size = bytes.len();
    // 根据扩展名判断媒体类型并校验上限
    let ext = std::path::Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    let max_bytes: Option<usize> = if matches!(ext.as_str(), "png" | "jpg" | "jpeg" | "webp" | "gif" | "bmp" | "tiff" | "tif") {
        Some(30 * 1024 * 1024) // 图片 30MB
    } else if matches!(ext.as_str(), "mp4" | "mov") {
        Some(50 * 1024 * 1024) // 视频 50MB
    } else if matches!(ext.as_str(), "mp3" | "wav" | "aac" | "ogg") {
        Some(15 * 1024 * 1024) // 音频 15MB
    } else {
        None // 未知类型，不限制
    };

    if let Some(limit) = max_bytes {
        if size > limit {
            let kind = if matches!(ext.as_str(), "png" | "jpg" | "jpeg" | "webp" | "gif" | "bmp") {
                "图片"
            } else if matches!(ext.as_str(), "mp4" | "mov") {
                "视频"
            } else {
                "音频"
            };
            let limit_mb = limit / 1024 / 1024;
            return Err(format!("{}文件超过 {}MB 限制（实际 {}MB），请压缩后重试", kind, limit_mb, size / 1024 / 1024));
        }
    }

    Ok(STANDARD.encode(&bytes))
}

/// 将二进制数据写入用户指定路径（用于截帧另存为等）
#[tauri::command]
pub fn write_file_bytes(path: String, bytes: Vec<u8>) -> Result<(), String> {
    std::fs::write(&path, &bytes).map_err(|e| format!("写入文件失败 {}：{}", path, e))
}

/// 将工程 assets 内相对路径文件复制到用户指定路径（视频/图片下载）
#[tauri::command]
pub fn copy_project_file(project_path: String, rel_path: String, dest_path: String) -> Result<(), String> {
    let src = std::path::Path::new(&project_path).join(&rel_path);
    if !src.is_file() {
        return Err(format!("源文件不存在：{}", src.display()));
    }
    std::fs::copy(&src, &dest_path).map_err(|e| {
        format!(
            "复制失败 {} → {}：{}",
            src.display(),
            dest_path,
            e
        )
    })?;
    Ok(())
}

/// 将 base64 数据写入用户指定路径（截帧另存为，避免 invoke 传大数组）
#[tauri::command]
pub fn write_file_base64(path: String, data_base64: String) -> Result<(), String> {
    let bytes = STANDARD
        .decode(data_base64.trim())
        .map_err(|e| format!("解码截图数据失败：{}", e))?;
    std::fs::write(&path, &bytes).map_err(|e| format!("写入文件失败 {}：{}", path, e))
}
