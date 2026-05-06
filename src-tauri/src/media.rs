use serde::Serialize;
use serde_json::json;
use std::path::Path;
use std::process::Command;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaMeta {
    pub duration_sec: Option<f64>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub fps: Option<f64>,
}

fn parse_ratio_f64(value: &str) -> Option<f64> {
    if let Some((a, b)) = value.split_once('/') {
        let num = a.parse::<f64>().ok()?;
        let den = b.parse::<f64>().ok()?;
        if den == 0.0 {
            return None;
        }
        return Some(num / den);
    }
    value.parse::<f64>().ok()
}

pub fn probe_media(path: &Path) -> Result<MediaMeta, String> {
    let output = Command::new("ffprobe")
        .args([
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            &path.to_string_lossy(),
        ])
        .output()
        .map_err(|e| format!("无法执行 ffprobe: {}", e))?;

    if !output.status.success() {
        return Err("ffprobe 执行失败".into());
    }

    let v: serde_json::Value =
        serde_json::from_slice(&output.stdout).map_err(|e| format!("解析 ffprobe 输出失败: {}", e))?;
    let duration = v
        .pointer("/format/duration")
        .and_then(|x| x.as_str())
        .and_then(|x| x.parse::<f64>().ok());

    let streams = v
        .get("streams")
        .and_then(|x| x.as_array())
        .cloned()
        .unwrap_or_default();
    let video_stream = streams
        .iter()
        .find(|s| s.get("codec_type").and_then(|x| x.as_str()) == Some("video"));

    let width = video_stream
        .and_then(|s| s.get("width"))
        .and_then(|x| x.as_u64())
        .map(|x| x as u32);
    let height = video_stream
        .and_then(|s| s.get("height"))
        .and_then(|x| x.as_u64())
        .map(|x| x as u32);
    let fps = video_stream
        .and_then(|s| s.get("avg_frame_rate"))
        .and_then(|x| x.as_str())
        .and_then(parse_ratio_f64);

    Ok(MediaMeta {
        duration_sec: duration,
        width,
        height,
        fps,
    })
}

/// M1-2.1：仅读文件头解析图片宽高，失败返回 `None`（不阻断导入）。
pub fn meta_json_for_image(path: &Path) -> Option<String> {
    let dim = imagesize::size(path).ok()?;
    let v = json!({
        "version": 1,
        "kind": "image",
        "width": dim.width as u32,
        "height": dim.height as u32,
    });
    serde_json::to_string(&v).ok()
}

/// M1-2.2：ffprobe 音视频元数据，并打上 `version` / `kind`。
pub fn meta_json_for_av(path: &Path, kind: &str) -> Option<String> {
    let probe = probe_media(path).ok()?;
    let mut v = serde_json::to_value(&probe).ok()?;
    if let Some(obj) = v.as_object_mut() {
        obj.insert("version".to_string(), json!(1));
        obj.insert("kind".to_string(), json!(kind));
    }
    serde_json::to_string(&v).ok()
}
