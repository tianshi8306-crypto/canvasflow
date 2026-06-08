use crate::command_common::{openai_v1_url, pick_enabled_provider};
use base64::Engine;
use crate::dreamina_cli::DreaminaCliState;
use crate::dreamina_gen;
use crate::project_asset_store::{self, AssetWriteContext};
use crate::settings;
use crate::vault;
use crate::AppState;
use std::path::PathBuf;

#[tauri::command]
pub async fn generate_image_asset(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    dreamina: tauri::State<'_, DreaminaCliState>,
    project_path: String,
    prompt: String,
    image_model_id: Option<String>,
    model: String,
    task: Option<String>,
    reference_image_paths: Option<Vec<String>>,
    aspect: Option<String>,
    resolution: Option<String>,
    count: Option<usize>,
    negative_prompt: Option<String>,
    style: Option<String>,
) -> Result<String, String> {
    use base64::Engine;
    use serde_json::json;

    if prompt.trim().is_empty() {
        return Err("提示词不能为空".into());
    }

    let resolved_model_for_route = if let Some(ref mid) = image_model_id {
        settings::load_settings(&app)?
            .image_models
            .iter()
            .find(|m| m.id == *mid)
            .map(|m| m.model.clone())
            .unwrap_or_else(|| model.clone())
    } else {
        model.clone()
    };

    if dreamina_gen::is_dreamina_model(&resolved_model_for_route)
        || dreamina_gen::is_dreamina_model(model.trim())
    {
        let model_id = if dreamina_gen::is_dreamina_model(&resolved_model_for_route) {
            resolved_model_for_route
        } else {
            model.trim().to_string()
        };
        return dreamina_gen::generate_image_via_cli(
            &dreamina,
            &state.http,
            &project_path,
            &prompt,
            &model_id,
            task.as_deref(),
            reference_image_paths,
            aspect,
            resolution,
            count,
        )
        .await;
    }

    let settings = settings::load_settings(&app)?;
    let (resolved_base_url, resolved_model, api_key, is_chat_endpoint) =
        if let Some(image_model_id) = image_model_id {
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
                let is_chat = is_chat_image_endpoint(cfg);
                (base, mdl, key, is_chat)
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
            (provider.base_url.trim().to_string(), mdl, key, false)
        };

    // image_edit：期望单张参考图（通常为当前节点预览图），与 image_to_image 共用 images[] 字段
    let refs = reference_image_paths.unwrap_or_default();
    let mut refs_b64: Vec<String> = Vec::new();
    for rel in refs.iter().take(4) {
        let abs = PathBuf::from(&project_path).join(rel);
        if let Ok(bytes) = std::fs::read(&abs) {
            refs_b64.push(base64::engine::general_purpose::STANDARD.encode(bytes));
        }
    }

    let n = dreamina_gen::normalize_image_generation_count(count);
    let mut rel_paths: Vec<String> = Vec::new();
    let root = PathBuf::from(&project_path);

    for i in 0..n {
        if is_chat_endpoint {
            // ── Chat Completions 模式（APIYI GPT-Image 等） ──
            let style_hint = style
                .as_ref()
                .filter(|s| !s.is_empty())
                .map(|s| format!(" Style: {s}."))
                .unwrap_or_default();
            let user_content = format!("Generate an image: {}{}", prompt, style_hint);
            // 若有参考图，在 content 中追加 image_url
            let mut user_parts: Vec<serde_json::Value> = vec![json!({
                "type": "text",
                "text": user_content,
            })];
            for b64 in &refs_b64 {
                user_parts.push(json!({
                    "type": "image_url",
                    "image_url": { "url": format!("data:image/png;base64,{}", b64) }
                }));
            }
            let chat_body = json!({
                "model": resolved_model,
                "messages": [{
                    "role": "user",
                    "content": user_parts
                }]
            });
            let url = openai_v1_url(&resolved_base_url, "chat/completions");
            eprintln!(
                "[media_gen] chat completions → {} model={} (第 {}/{})",
                url, resolved_model, i + 1, n
            );
            let resp = state
                .http
                .post(&url)
                .header("Authorization", format!("Bearer {}", api_key))
                .json(&chat_body)
                .send()
                .await
                .map_err(|e| format!("Chat 图片生成请求失败：{}", e))?;

            let status = resp.status();
            let text = resp
                .text()
                .await
                .map_err(|e| format!("读取 Chat 响应失败：{}", e))?;
            let parsed: serde_json::Value =
                serde_json::from_str(&text).unwrap_or_else(|_| json!({ "raw": text }));
            if !status.is_success() {
                return Err(format!(
                    "第 {} 张图片生成失败: {}",
                    i + 1,
                    serde_json::to_string(&parsed).unwrap_or_default()
                ));
            }

            // 从 chat 响应中提取图片数据
            let bytes: Vec<u8> = extract_image_from_chat_response(&parsed, &state.http)
                .await?;

            let seq_tag = format!("seq{}", i + 1);
            let ctx = AssetWriteContext {
                kind: "image",
                source: "generate",
                workflow: task.as_deref(),
                node_id: None,
                job_id: Some(seq_tag.as_str()),
            };
            let rel = project_asset_store::write_bytes_to_project_asset(
                &root, &bytes, "png", &ctx,
            )?;
            rel_paths.push(rel);
        } else {
            // ── 标准 Images API 模式 ──
            let size = resolution.as_deref().unwrap_or("1024x1024");
            let mut body = json!({
                "model": resolved_model,
                "prompt": prompt,
                "size": size,
                "response_format": "b64_json",
            });
            if let Some(obj) = body.as_object_mut() {
                if let Some(t) = &task {
                    obj.insert("task".into(), json!(t));
                }
                if let Some(first) = refs_b64.first() {
                    obj.insert("image".into(), json!(first));
                }
                if !refs_b64.is_empty() {
                    obj.insert("images".into(), json!(refs_b64));
                }
                if let Some(np) = negative_prompt.as_ref() {
                    if !np.is_empty() {
                        obj.insert("negative_prompt".into(), json!(np));
                    }
                }
                if let Some(s) = style.as_ref() {
                    if !s.is_empty() {
                        obj.insert("style".into(), json!(s));
                    }
                }
            }

            let url = openai_v1_url(&resolved_base_url, "images/generations");
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
                    "第 {} 张图片生成失败: {}",
                    i + 1,
                    serde_json::to_string(&parsed).unwrap_or_default()
                ));
            }

            let bytes = if let Some(b64) =
                parsed.pointer("/data/0/b64_json").and_then(|v| v.as_str())
            {
                decode_image_b64_payload(b64)?
            } else if let Some(img_url) =
                parsed.pointer("/data/0/url").and_then(|v| v.as_str())
            {
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

            let seq_tag = format!("seq{}", i + 1);
            let ctx = AssetWriteContext {
                kind: "image",
                source: "generate",
                workflow: task.as_deref(),
                node_id: None,
                job_id: Some(seq_tag.as_str()),
            };
            let rel =
                project_asset_store::write_bytes_to_project_asset(&root, &bytes, "png", &ctx)?;
            rel_paths.push(rel);
        }
    }

    // 多张时返回 JSON 数组，单张时返回字符串供兼容
    if rel_paths.len() == 1 {
        Ok(rel_paths.into_iter().next().unwrap())
    } else {
        Ok(serde_json::to_string(&rel_paths).unwrap())
    }
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
    let ctx = AssetWriteContext {
        kind: "audio",
        source: "tts",
        workflow: None,
        node_id: None,
        job_id: None,
    };
    project_asset_store::write_bytes_to_project_asset(&root, &bytes, "mp3", &ctx)
}

/// OpenAI 兼容 `POST /v1/audio/transcriptions`：Hermes 语音输入（Whisper）。
#[tauri::command]
pub async fn transcribe_speech_audio(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    audio_base64: String,
    file_name: Option<String>,
    language: Option<String>,
) -> Result<String, String> {
    use base64::Engine;
    use reqwest::multipart;
    use serde_json::json;

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(audio_base64.trim())
        .map_err(|e| format!("音频解码失败：{}", e))?;
    if bytes.is_empty() {
        return Err("音频为空".into());
    }

    let settings = settings::load_settings(&app)?;
    let provider = pick_enabled_provider(&settings)?;
    let api_key = vault::get_api_key(&provider.id)?
        .ok_or_else(|| format!("未配置 API Key：{}", provider.label))?;
    let base_url = provider.base_url.trim().to_string();

    let fname = file_name
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "speech.webm".to_string());
    let mime = if fname.ends_with(".wav") {
        "audio/wav"
    } else if fname.ends_with(".m4a") || fname.ends_with(".mp4") {
        "audio/mp4"
    } else if fname.ends_with(".ogg") {
        "audio/ogg"
    } else {
        "audio/webm"
    };

    let part = multipart::Part::bytes(bytes)
        .file_name(fname)
        .mime_str(mime)
        .map_err(|e| e.to_string())?;
    let mut form = multipart::Form::new()
        .part("file", part)
        .text("model", "whisper-1");
    if let Some(lang) = language.filter(|s| !s.trim().is_empty()) {
        form = form.text("language", lang.trim().to_string());
    }

    let url = format!("{}/audio/transcriptions", base_url.trim_end_matches('/'));
    let resp = state
        .http
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("语音识别请求失败：{}", e))?;

    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("读取识别响应失败：{}", e))?;
    if !status.is_success() {
        let parsed: serde_json::Value =
            serde_json::from_str(&text).unwrap_or_else(|_| json!({ "raw": text }));
        return Err(format!(
            "语音识别失败: {}",
            serde_json::to_string(&parsed).unwrap_or_default()
        ));
    }

    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&text) {
        if let Some(t) = parsed.get("text").and_then(|v| v.as_str()) {
            return Ok(t.trim().to_string());
        }
    }
    Ok(text.trim().to_string())
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

    let is_chat = is_chat_image_endpoint(cfg);

    if is_chat {
        let url = openai_v1_url(&cfg.api_base_url, "models");
        let resp = state
            .http
            .get(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .send()
            .await
            .map_err(|e| format!("连接失败：{}", e))?;

        let status = resp.status();
        if status.is_success() {
            return Ok(format!("连接成功，Chat 模式已确认型号：{}", cfg.model));
        }
        let text = resp.text().await.map_err(|e| e.to_string())?;
        return Err(format!("连接失败({})：{}", status.as_u16(), text));
    }

    let url = openai_v1_url(&cfg.api_base_url, "models");
    let resp = state
        .http
        .get(&url)
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

/// gpt-image 等 APIYI 模型走标准 Images API，即使 settings 里误标为 chat。
fn is_chat_image_endpoint(cfg: &settings::ImageModelConfig) -> bool {
    if cfg.endpoint_type.as_deref() != Some("chat") {
        return false;
    }
    let model = cfg.model.to_lowercase();
    let base = cfg.api_base_url.to_lowercase();
    if model.contains("gpt-image") && base.contains("apiyi") {
        return false;
    }
    true
}

/// 解码图片 base64；兼容 APIYI 返回的 `data:image/png;base64,...` 前缀。
fn decode_image_b64_payload(raw: &str) -> Result<Vec<u8>, String> {
    let trimmed = raw.trim();
    let b64 = if let Some(idx) = trimmed.find("base64,") {
        &trimmed[idx + 7..]
    } else {
        trimmed
    };
    base64::engine::general_purpose::STANDARD
        .decode(b64)
        .map_err(|e| format!("解析图片 base64 失败：{}", e))
}

/// 从 Chat Completions 响应中提取图片字节。
///
/// GPT-4o 等模型的图片生成响应格式：
/// choices[0].message.content 可能是：
///   - 字符串（无图片）
///   - 数组：[{type: "text", text: "..."}, {type: "image_url", image_url: {url: "data:image/...;base64,..."}}]
///
/// 也支持 Markdown 图片语法的字符串内容: ![img](data:image/...;base64,...)
async fn extract_image_from_chat_response(
    parsed: &serde_json::Value,
    http_client: &reqwest::Client,
) -> Result<Vec<u8>, String> {
    use base64::Engine;

    // 路径 1：choices[0].message.content 是数组，从中找 image_url
    if let Some(content) = parsed
        .pointer("/choices/0/message/content")
        .and_then(|v| v.as_array())
    {
        for part in content {
            if part.get("type").and_then(|v| v.as_str()) == Some("image_url") {
                if let Some(img_url) = part
                    .pointer("/image_url/url")
                    .and_then(|v| v.as_str())
                {
                    return decode_image_string(img_url, http_client).await;
                }
            }
        }
    }

    // 路径 2：choices[0].message.content 是字符串，可能包含 Markdown 图片
    if let Some(text) = parsed
        .pointer("/choices/0/message/content")
        .and_then(|v| v.as_str())
    {
        // 尝试从 Markdown ![](data:...) 中提取
        if let Some(start) = text.find("data:image/") {
            let slice = &text[start..];
            let end = slice.find(')').unwrap_or(slice.len());
            return decode_image_string(&slice[..end], http_client).await;
        }
        // 尝试从纯 base64 字符串中提取
        if text.len() > 64 && !text.contains(' ') {
            if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(text) {
                if bytes.len() > 64 {
                    return Ok(bytes);
                }
            }
        }
    }

    // 路径 3：顶层 data[0].b64_json / data[0].url（兼容某些 chat 封装）
    if let Some(b64) = parsed.pointer("/data/0/b64_json").and_then(|v| v.as_str()) {
        return Ok(decode_image_b64_payload(b64)?);
    }
    if let Some(img_url) = parsed.pointer("/data/0/url").and_then(|v| v.as_str()) {
        return Ok(http_client
            .get(img_url)
            .send()
            .await
            .map_err(|e| format!("下载 Chat 图片失败：{}", e))?
            .bytes()
            .await
            .map_err(|e| format!("读取 Chat 图片失败：{}", e))?
            .to_vec());
    }

    Err("Chat 响应中未找到图片数据（提示：请确认模型支持图片生成）".into())
}

/// 从图片 URL（data: URL 或 http(s) URL）中获取字节
async fn decode_image_string(
    s: &str,
    http_client: &reqwest::Client,
) -> Result<Vec<u8>, String> {
    let trimmed = s.trim();
    if trimmed.contains("base64,") {
        return decode_image_b64_payload(trimmed);
    }
    if trimmed.starts_with("http") {
        return Ok(http_client
            .get(trimmed)
            .send()
            .await
            .map_err(|e| format!("下载 Chat 图片失败：{}", e))?
            .bytes()
            .await
            .map_err(|e| format!("读取 Chat 图片失败：{}", e))?
            .to_vec());
    }
    Err(format!("无法识别的图片字符串格式: {}", &trimmed[..trimmed.len().min(80)]))
}
