use keyring::{Entry, Error};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

const SERVICE: &str = "com.canvasflow.studio";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct LocalVaultFile {
    #[serde(default)]
    keys: HashMap<String, String>,
}

fn local_vault_path() -> Result<PathBuf, String> {
    #[cfg(windows)]
    {
        let base = std::env::var("APPDATA")
            .map(PathBuf::from)
            .map_err(|_| "无法读取 APPDATA 环境变量".to_string())?;
        let dir = base.join("canvasflow");
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        return Ok(dir.join("api-keys.json"));
    }
    #[cfg(not(windows))]
    {
        let home = std::env::var("HOME")
            .map(PathBuf::from)
            .map_err(|_| "无法读取 HOME 环境变量".to_string())?;
        let dir = home.join(".config").join("canvasflow");
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        Ok(dir.join("api-keys.json"))
    }
}

fn read_local_vault() -> Result<LocalVaultFile, String> {
    let path = local_vault_path()?;
    if !path.exists() {
        return Ok(LocalVaultFile::default());
    }
    let raw = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    let parsed: LocalVaultFile = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    Ok(parsed)
}

fn write_local_vault(v: &LocalVaultFile) -> Result<(), String> {
    let path = local_vault_path()?;
    let raw = serde_json::to_string_pretty(v).map_err(|e| e.to_string())?;
    std::fs::write(path, raw).map_err(|e| e.to_string())
}

pub fn store_api_key(provider_id: &str, api_key: &str) -> Result<(), String> {
    let key = format!("provider:{}", provider_id);
    let entry = Entry::new(SERVICE, &key).map_err(|e| e.to_string())?;
    // 优先写系统凭据；若系统凭据不可用则降级写本地 vault（单机可用优先）。
    if let Err(e) = entry.set_password(api_key) {
        let mut lv = read_local_vault()?;
        lv.keys.insert(provider_id.to_string(), api_key.to_string());
        write_local_vault(&lv).map_err(|e2| format!("系统凭据写入失败：{}；本地兜底写入失败：{}", e, e2))?;
        return Ok(());
    }
    // 系统凭据写入成功时同步更新本地副本（用于兜底读取与迁移）。
    let mut lv = read_local_vault().unwrap_or_default();
    lv.keys.insert(provider_id.to_string(), api_key.to_string());
    let _ = write_local_vault(&lv);
    Ok(())
}

pub fn get_api_key(provider_id: &str) -> Result<Option<String>, String> {
    // 供 `tests/` 下 Wiremock 集成测试注入假 Key；勿在生产环境设置 `CANVASFLOW_TEST_API_KEY`。
    if let Ok(k) = std::env::var("CANVASFLOW_TEST_API_KEY") {
        let k = k.trim().to_string();
        if !k.is_empty() {
            let _ = provider_id;
            return Ok(Some(k));
        }
    }
    let key = format!("provider:{}", provider_id);
    let entry = Entry::new(SERVICE, &key).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(s) => Ok(Some(s)),
        Err(e) => {
            if let Error::NoEntry = e {
                let lv = read_local_vault().unwrap_or_default();
                Ok(lv.keys.get(provider_id).cloned())
            } else {
                // 某些系统凭据服务异常时，兜底读取本地 vault。
                let lv = read_local_vault().unwrap_or_default();
                if let Some(v) = lv.keys.get(provider_id) {
                    Ok(Some(v.clone()))
                } else {
                    Err(e.to_string())
                }
            }
        }
    }
}

pub fn delete_api_key(provider_id: &str) -> Result<(), String> {
    let key = format!("provider:{}", provider_id);
    let entry = Entry::new(SERVICE, &key).map_err(|e| e.to_string())?;
    let mut local_err: Option<String> = None;
    let mut lv = read_local_vault().unwrap_or_default();
    lv.keys.remove(provider_id);
    if let Err(e) = write_local_vault(&lv) {
        local_err = Some(e);
    }
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(e) => {
            if let Error::NoEntry = e {
                if let Some(le) = local_err {
                    Err(le)
                } else {
                    Ok(())
                }
            } else {
                if let Some(le) = local_err {
                    Err(format!("系统凭据删除失败：{}；本地删除失败：{}", e, le))
                } else {
                    Err(e.to_string())
                }
            }
        }
    }
}
