use crate::command_common::register_project_asset_scope;
use std::path::PathBuf;
use tauri::Manager;

/// 同步命令：在部分平台上文件夹对话框与 WebView 焦点强相关，避免 `async` + 阻塞对话框卡在运行时线程上。
#[tauri::command]
pub fn pick_project_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let folder = app.dialog().file().blocking_pick_folder();

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
    register_project_asset_scope(&app, &project_path)?;
    Ok(())
}

#[tauri::command]
pub fn read_canvasflow_json(project_path: String) -> Result<String, String> {
    let path = PathBuf::from(&project_path).join("canvasflow.json");
    std::fs::read_to_string(&path).map_err(|e| format!("读取 canvasflow.json 失败: {}", e))
}

#[tauri::command]
pub fn write_canvasflow_json(project_path: String, content: String) -> Result<(), String> {
    let path = PathBuf::from(&project_path).join("canvasflow.json");
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, content).map_err(|e| e.to_string())
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
