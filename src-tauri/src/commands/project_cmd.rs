use crate::command_common::register_project_asset_scope;
use crate::media::{probe_image_file, probe_media, ImageFileProbe, MediaMeta};
use std::path::PathBuf;
use tauri::Manager;

/// 同步命令：在部分平台上文件夹对话框与 WebView 焦点强相关，避免 `async` + 阻塞对话框卡在运行时线程上。
#[tauri::command]
pub fn pick_project_folder(
    app: tauri::AppHandle,
    default_directory: Option<String>,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let mut builder = app.dialog().file();
    if let Some(dir) = default_directory {
        let trimmed = dir.trim();
        if !trimmed.is_empty() {
            let path = PathBuf::from(trimmed);
            if path.is_dir() {
                builder = builder.set_directory(path);
            }
        }
    }
    let folder = builder.blocking_pick_folder();

    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
    }

    match folder {
        None => Ok(None),
        Some(p) => {
            let path = p.into_path().map_err(|e| e.to_string())?;
            Ok(Some(path.to_string_lossy().into_owned()))
        }
    }
}

#[tauri::command]
pub fn ensure_project_structure(app: tauri::AppHandle, project_path: String) -> Result<(), String> {
    let root = PathBuf::from(&project_path);
    std::fs::create_dir_all(root.join("assets")).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(root.join(".canvasflow")).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(root.join(".canvasflow/templates")).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(root.join(".canvasflow/workflows")).map_err(|e| e.to_string())?;
    register_project_asset_scope(&app, &project_path)?;
    Ok(())
}

#[tauri::command]
pub fn read_canvasflow_json(project_path: String) -> Result<String, String> {
    let path = PathBuf::from(&project_path).join("canvasflow.json");
    std::fs::read_to_string(&path).map_err(|e| format!("读取 canvasflow.json 失败: {}", e))
}

#[tauri::command]
pub async fn write_canvasflow_json_bytes(
    project_path: String,
    content: Vec<u8>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let path = PathBuf::from(&project_path).join("canvasflow.json");
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let tmp = path.with_extension("json.tmp");
        std::fs::write(&tmp, &content).map_err(|e| e.to_string())?;
        if path.exists() {
            std::fs::remove_file(&path).map_err(|e| e.to_string())?;
        }
        std::fs::rename(&tmp, &path).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("写入 canvasflow.json 任务失败: {}", e))?
}

#[tauri::command]
pub async fn write_canvasflow_json(project_path: String, content: String) -> Result<(), String> {
    write_canvasflow_json_bytes(project_path, content.into_bytes()).await
}

#[derive(serde::Serialize)]
pub struct GroupTemplateSummary {
    pub id: String,
    pub name: String,
    pub rel_path: String,
    pub created_at: u64,
}

#[derive(serde::Serialize)]
pub struct WorkflowSummary {
    pub id: String,
    pub name: String,
    pub rel_path: String,
    pub created_at: u64,
    pub node_count: u32,
    pub edge_count: u32,
    pub kind: String,
}

#[tauri::command]
pub fn write_project_rel_text_file(
    project_path: String,
    rel_path: String,
    content: String,
) -> Result<(), String> {
    let rel = rel_path.replace('\\', "/");
    let path = PathBuf::from(&project_path).join(&rel);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, content).map_err(|e| format!("写入 {} 失败: {}", path.display(), e))
}

#[tauri::command]
pub fn read_project_rel_text_file(project_path: String, rel_path: String) -> Result<String, String> {
    let rel = rel_path.replace('\\', "/");
    let path = PathBuf::from(&project_path).join(&rel);
    std::fs::read_to_string(&path).map_err(|e| format!("读取 {} 失败: {}", path.display(), e))
}

/// ffprobe 工程内媒体相对路径（供参考视频横幅等 UI 展示元信息）
#[tauri::command]
pub fn probe_project_rel_media(
    project_path: String,
    rel_path: String,
) -> Result<MediaMeta, String> {
    let rel = rel_path.replace('\\', "/").trim_start_matches('/').to_string();
    let path = PathBuf::from(project_path.trim()).join(&rel);
    probe_media(&path)
}

/// 工程内图片：宽高 + 文件大小（Seedance 2.0 合规预检）
#[tauri::command]
pub fn probe_project_rel_image(
    project_path: String,
    rel_path: String,
) -> Result<ImageFileProbe, String> {
    let rel = rel_path.replace('\\', "/").trim_start_matches('/').to_string();
    let path = PathBuf::from(project_path.trim()).join(&rel);
    probe_image_file(&path)
}

/// 列出工程内某相对目录下的文件（仅一层，返回相对路径）
#[tauri::command]
pub fn list_project_rel_dir_files(
    project_path: String,
    rel_dir: String,
) -> Result<Vec<String>, String> {
    let project = PathBuf::from(project_path.trim());
    let dir = project.join(rel_dir.replace('\\', "/"));
    if !dir.is_dir() {
        return Ok(vec![]);
    }
    let mut out = Vec::new();
    for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let rel = path
            .strip_prefix(&project)
            .map_err(|_| "路径解析失败".to_string())?
            .to_string_lossy()
            .replace('\\', "/");
        out.push(rel);
    }
    out.sort();
    Ok(out)
}

#[tauri::command]
pub fn list_group_template_summaries(project_path: String) -> Result<Vec<GroupTemplateSummary>, String> {
    let dir = PathBuf::from(&project_path).join(".canvasflow/templates");
    if !dir.is_dir() {
        return Ok(vec![]);
    }
    let mut out = Vec::new();
    for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("json") {
            continue;
        }
        let rel_path = format!(
            ".canvasflow/templates/{}",
            path.file_name().and_then(|s| s.to_str()).unwrap_or("template.json")
        );
        let raw = std::fs::read_to_string(&path).unwrap_or_default();
        let (id, name, created_at) = if let Ok(v) = serde_json::from_str::<serde_json::Value>(&raw) {
            let id = v
                .get("id")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string();
            let name = v
                .get("name")
                .and_then(|x| x.as_str())
                .unwrap_or("分组模板")
                .to_string();
            let created_at = v.get("createdAt").and_then(|x| x.as_u64()).unwrap_or(0);
            (
                if id.is_empty() {
                    path.file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("template")
                        .to_string()
                } else {
                    id
                },
                name,
                created_at,
            )
        } else {
            (
                path.file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("template")
                    .to_string(),
                "分组模板".to_string(),
                0,
            )
        };
        out.push(GroupTemplateSummary {
            id,
            name,
            rel_path,
            created_at,
        });
    }
    out.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(out)
}

#[tauri::command]
pub fn list_workflow_summaries(project_path: String) -> Result<Vec<WorkflowSummary>, String> {
    let dir = PathBuf::from(&project_path).join(".canvasflow/workflows");
    if !dir.is_dir() {
        return Ok(vec![]);
    }
    let mut out = Vec::new();
    for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("json") {
            continue;
        }
        let rel_path = format!(
            ".canvasflow/workflows/{}",
            path.file_name().and_then(|s| s.to_str()).unwrap_or("workflow.json")
        );
        let raw = std::fs::read_to_string(&path).unwrap_or_default();
        let (id, name, created_at, node_count, edge_count, kind) =
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&raw) {
                let id = v
                    .get("id")
                    .and_then(|x| x.as_str())
                    .unwrap_or("")
                    .to_string();
                let name = v
                    .get("name")
                    .and_then(|x| x.as_str())
                    .unwrap_or("工作流")
                    .to_string();
                let created_at = v.get("createdAt").and_then(|x| x.as_u64()).unwrap_or(0);
                let kind = v
                    .get("kind")
                    .and_then(|x| x.as_str())
                    .unwrap_or("selection")
                    .to_string();
                let nodes_len = v
                    .get("nodes")
                    .and_then(|x| x.as_array())
                    .map(|a| a.len() as u32)
                    .unwrap_or(0);
                let edges_len = v
                    .get("edges")
                    .and_then(|x| x.as_array())
                    .map(|a| a.len() as u32)
                    .unwrap_or(0);
                let group_extra = if kind == "group" { 1 } else { 0 };
                (
                    if id.is_empty() {
                        path.file_stem()
                            .and_then(|s| s.to_str())
                            .unwrap_or("workflow")
                            .to_string()
                    } else {
                        id
                    },
                    name,
                    created_at,
                    nodes_len + group_extra,
                    edges_len,
                    kind,
                )
            } else {
                (
                    path.file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("workflow")
                        .to_string(),
                    "工作流".to_string(),
                    0,
                    0,
                    0,
                    "selection".to_string(),
                )
            };
        out.push(WorkflowSummary {
            id,
            name,
            rel_path,
            created_at,
            node_count,
            edge_count,
            kind,
        });
    }
    out.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(out)
}

#[tauri::command]
pub fn delete_project_rel_file(project_path: String, rel_path: String) -> Result<(), String> {
    let rel = rel_path.replace('\\', "/");
    let path = PathBuf::from(project_path.trim()).join(&rel);
    if path.is_file() {
        std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn open_project_dir(project_path: String) -> Result<(), String> {
    let path = PathBuf::from(project_path);
    #[cfg(windows)]
    {
        std::process::Command::new("explorer")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
