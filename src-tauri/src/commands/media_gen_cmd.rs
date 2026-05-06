use crate::command_common::pick_enabled_provider;
use crate::db;
use crate::media;
use crate::settings;
use crate::vault;
use crate::AppState;
use std::path::PathBuf;

#[tauri::command]
pub async fn generate_image_asset(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    project_path: String,
    prompt: String,
    image_model_id: Option<String>,
    model: String,
    task: Option<String>,
    reference_image_paths: Option<Vec<String>>,
) -> Result<String, String> {
    use base64::Engine;
    use serde_json::json;

    if prompt.trim().is_empty() {
        return Err("提示词不能为空".into());
    }

    let settings = settings::load_settings(&app)?;
    let (resolved_base_url, resolved_model, api_key) = if let Some(image_model_id) = image_model_id {
        if let Some(cfg) = settings
            .image_models
            .iter()
            .find(|m| m.id == image_model_id && m.enabled)
        {
            let key_id = format!("image-model:{}", cfg.id);
            let key = vault::get_api_key(&key_id)?
                .ok_or_else(|| format!("未配置图片模型 API Key：{}", cfg.label))?;
            let base = if cfg.api_base_url.trim().is_empty() {
                return Err(format!("图片模型未配置 API 地址：{}", cfg.label));
            } else {
                cfg.api_base_url.trim().to_string()
            };
            let mdl = if cfg.model.trim().is_empty() {
                return Err(format!("图片模型未配置模型型号：{}", cfg.label));
            } else {
                cfg.model.trim().to_string()
            };
            (base, mdl, key)
        } else {
            return Err("所选图片模型不存在或已禁用，请到设置中检查".into());
        }
    } else {
        let provider = pick_enabled_provider(&settings)?;
        let key = vault::get_api_key(&provider.id)?
            .ok_or_else(|| format!("未配置 API Key：{}", provider.label))?;
        let mdl = if model.trim().is_empty() {
            provider.model.clone()
        } else {
            model.trim().to_string()
        };
        (provider.base_url.trim().to_string(), mdl, key)
    };

    let refs = reference_image_paths.unwrap_or_default();
    let mut refs_b64: Vec<String> = Vec::new();
    for rel in refs.iter().take(4) {
        let abs = PathBuf::from(&project_path).join(rel);
        if let Ok(bytes) = std::fs::read(&abs) {
            refs_b64.push(base64::engine::general_purpose::STANDARD.encode(bytes));
        }
    }

    let mut body = json!({
        "model": resolved_model,
        "prompt": prompt,
        "size": "1024x1024",
        "response_format": "b64_json",
    });
    if let Some(obj) = body.as_object_mut() {
        if let Some(t) = task {
            obj.insert("task".into(), json!(t));
        }
        if let Some(first) = refs_b64.first() {
            obj.insert("image".into(), json!(first));
        }
        if !refs_b64.is_empty() {
            obj.insert("images".into(), json!(refs_b64));
        }
    }

    let url = format!(
        "{}/images/generations",
        resolved_base_url.trim_end_matches('/')
    );
    let resp = state
        .http
        .post(url)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("请求图片生成失败：{}", e))?;

    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| format!("读取图片响应失败：{}", e))?;
    let parsed: serde_json::Value =
        serde_json::from_str(&text).unwrap_or_else(|_| json!({ "raw": text }));
    if !status.is_success() {
        return Err(format!(
            "图片生成失败: {}",
            serde_json::to_string(&parsed).unwrap_or_default()
        ));
    }

    let bytes = if let Some(b64) = parsed.pointer("/data/0/b64_json").and_then(|v| v.as_str()) {
        base64::engine::general_purpose::STANDARD
            .decode(b64)
            .map_err(|e| format!("解析图片失败：{}", e))?
    } else if let Some(img_url) = parsed.pointer("/data/0/url").and_then(|v| v.as_str()) {
        state
            .http
            .get(img_url)
            .send()
            .await
            .map_err(|e| format!("下载图片失败：{}", e))?
            .bytes()
            .await
            .map_err(|e| format!("读取下载图片失败：{}", e))?
            .to_vec()
    } else {
        return Err("返回内容中未找到图片数据".into());
    };

    let root = PathBuf::from(&project_path);
    let assets_dir = root.join("assets");
    std::fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;
    let file_name = format!(
        "gen_{}_{}.png",
        chrono::Utc::now().format("%Y%m%d_%H%M%S"),
        &uuid::Uuid::new_v4().to_string()[..8]
    );
    let out = assets_dir.join(&file_name);
    std::fs::write(&out, bytes).map_err(|e| format!("保存图片失败：{}", e))?;

    let rel = format!("assets/{}", file_name);
    let conn = db::open_run_db(&root)?;
    let meta_json = media::meta_json_for_image(&out);
    let _aid = db::upsert_asset(&conn, &rel, "image", Some("generate"), meta_json.as_deref())?;
    Ok(rel)
}

/// OpenAI 兼容 `POST /v1/audio/speech`：生成 MP3 写入工程 `assets/`，并登记素材库。
#[tauri::command]
pub async fn generate_tts_asset(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    project_path: String,
    text: String,
    audio_model_id: Option<String>,
    model: String,
    voice: Option<String>,
) -> Result<String, String> {
    use serde_json::json;

    let t = text.trim();
    if t.is_empty() {
        return Err("文本不能为空".into());
    }
    let voice_raw = voice.unwrap_or_else(|| "alloy".to_string());
    let voice = voice_raw.trim();
    if voice.is_empty() {
        return Err("音色 voice 不能为空".into());
    }

    let settings = settings::load_settings(&app)?;
    let audio_model_id = audio_model_id.filter(|s| !s.trim().is_empty());

    let (base_url, resolved_model, api_key) = if let Some(ref mid) = audio_model_id {
        let cfg = settings
            .audio_models
            .iter()
            .find(|m| m.id == *mid && m.enabled)
            .ok_or_else(|| "所选语音模型不存在或已禁用，请到设置中检查".to_string())?;
        let key_id = format!("audio-model:{}", cfg.id);
        let key = vault::get_api_key(&key_id)?
            .ok_or_else(|| format!("未配置语音模型 API Key：{}", cfg.label))?;
        let base = cfg.api_base_url.trim().to_string();
        if base.is_empty() {
            return Err(format!("语音模型未配置 API 地址：{}", cfg.label));
        }
        let mdl = cfg.model.trim().to_string();
        if mdl.is_empty() {
            return Err(format!("语音模型未配置 model 标识：{}", cfg.label));
        }
        (base, mdl, key)
    } else {
        let provider = pick_enabled_provider(&settings)?;
        let key = vault::get_api_key(&provider.id)?
            .ok_or_else(|| format!("未配置 API Key：{}", provider.label))?;
        let mdl = if model.trim().is_empty() {
            "tts-1".to_string()
        } else {
            model.trim().to_string()
        };
        (provider.base_url.trim().to_string(), mdl, key)
    };

    let url = format!("{}/audio/speech", base_url.trim_end_matches('/'));
    let body = json!({
        "model": resolved_model,
        "input": t,
        "voice": voice,
        "response_format": "mp3"
    });

    let resp = state
        .http
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("TTS 请求失败：{}", e))?;

    let status = resp.status();
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("读取 TTS 响应失败：{}", e))?;
    if !status.is_success() {
        let text = String::from_utf8_lossy(&bytes).to_string();
        let parsed: serde_json::Value =
            serde_json::from_str(&text).unwrap_or_else(|_| json!({ "raw": text }));
        return Err(format!(
            "TTS 失败: {}",
            serde_json::to_string(&parsed).unwrap_or_default()
        ));
    }

    let root = PathBuf::from(&project_path);
    let assets_dir = root.join("assets");
    std::fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;
    let file_name = format!(
        "tts_{}_{}.mp3",
        chrono::Utc::now().format("%Y%m%d_%H%M%S"),
        &uuid::Uuid::new_v4().to_string()[..8]
    );
    let out = assets_dir.join(&file_name);
    std::fs::write(&out, &bytes).map_err(|e| format!("保存音频失败：{}", e))?;

    let rel = format!("assets/{}", file_name);
    let conn = db::open_run_db(&root)?;
    let meta_json = media::meta_json_for_av(&out, "audio");
    let _aid = db::upsert_asset(&conn, &rel, "audio", Some("tts"), meta_json.as_deref())?;
    Ok(rel)
}

#[tauri::command]
pub async fn test_image_model_connection(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    image_model_id: String,
    api_key_override: Option<String>,
) -> Result<String, String> {
    use serde_json::json;

    let settings = settings::load_settings(&app)?;
    let cfg = settings
        .image_models
        .iter()
        .find(|m| m.id == image_model_id)
        .ok_or_else(|| "未找到图片模型配置".to_string())?;

    if cfg.api_base_url.trim().is_empty() {
        return Err("请先填写 API 地址".into());
    }
    if cfg.model.trim().is_empty() {
        return Err("请先选择模型型号".into());
    }

    let api_key = if let Some(v) = api_key_override {
        if v.trim().is_empty() {
            return Err("API Key 为空".into());
        }
        v.trim().to_string()
    } else {
        let key_id = format!("image-model:{}", cfg.id);
        vault::get_api_key(&key_id)?
            .ok_or_else(|| "请先填写并保存 API Key".to_string())?
    };

    let url = format!("{}/models", cfg.api_base_url.trim_end_matches('/'));
    let resp = state
        .http
        .get(url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| format!("连接失败：{}", e))?;

    let status = resp.status();
    let text = resp.text().await.map_err(|e| e.to_string())?;
    let parsed: serde_json::Value = serde_json::from_str(&text).unwrap_or_else(|_| json!({ "raw": text }));
    if !status.is_success() {
        return Err(format!(
            "连接失败({})：{}",
            status.as_u16(),
            serde_json::to_string(&parsed).unwrap_or_default()
        ));
    }

    let model_found = parsed
        .get("data")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter().any(|m| {
                m.get("id")
                    .and_then(|id| id.as_str())
                    .map(|id| id == cfg.model)
                    .unwrap_or(false)
            })
        })
        .unwrap_or(false);
    if model_found {
        Ok(format!("连接成功，已确认模型：{}", cfg.model))
    } else {
        Ok("连接成功（接口可用），但模型列表中未找到当前型号，请再核对模型名".into())
    }
}
