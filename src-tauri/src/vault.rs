use keyring::{Entry, Error};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

fn is_dev_profile() -> bool {
    cfg!(debug_assertions)
}

fn keyring_service() -> &'static str {
    if is_dev_profile() {
        "com.canvasflow.studio.dev"
    } else {
        "com.canvasflow.studio"
    }
}

fn local_data_dir_name() -> &'static str {
    if is_dev_profile() {
        "canvasflow-dev"
    } else {
        "canvasflow"
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct LocalVaultFile {
    #[serde(default)]
    keys: HashMap<String, String>,
}

fn user_data_base() -> Result<PathBuf, String> {
    #[cfg(windows)]
    {
        std::env::var("APPDATA")
            .map(PathBuf::from)
            .map_err(|_| "无法读取 APPDATA 环境变量".to_string())
    }
    #[cfg(not(windows))]
    {
        std::env::var("HOME")
            .map(PathBuf::from)
            .map_err(|_| "无法读取 HOME 环境变量".to_string())
            .map(|home| home.join(".config"))
    }
}

fn local_vault_path() -> Result<PathBuf, String> {
    let dir = user_data_base()?.join(local_data_dir_name());
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("api-keys.json"))
}

/// 旧版 dev/release 共用的明文路径（仅用于一次性迁移）。
fn legacy_shared_local_vault_path() -> PathBuf {
    user_data_base()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("canvasflow")
        .join("api-keys.json")
}

fn read_local_vault_at(path: &PathBuf) -> Result<LocalVaultFile, String> {
    if !path.exists() {
        return Ok(LocalVaultFile::default());
    }
    let raw = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    let parsed: LocalVaultFile = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    Ok(parsed)
}

fn read_local_vault() -> Result<LocalVaultFile, String> {
    read_local_vault_at(&local_vault_path()?)
}

fn write_local_vault(v: &LocalVaultFile) -> Result<(), String> {
    let path = local_vault_path()?;
    if v.keys.is_empty() {
        if path.exists() {
            std::fs::remove_file(path).map_err(|e| e.to_string())?;
        }
        return Ok(());
    }
    let raw = serde_json::to_string_pretty(v).map_err(|e| e.to_string())?;
    std::fs::write(path, raw).map_err(|e| e.to_string())
}

fn keyring_entry(provider_id: &str) -> Result<Entry, String> {
    let key = format!("provider:{}", provider_id);
    Entry::new(keyring_service(), &key).map_err(|e| e.to_string())
}

fn store_in_keyring(provider_id: &str, api_key: &str) -> Result<(), String> {
    keyring_entry(provider_id)?
        .set_password(api_key)
        .map_err(|e| e.to_string())
}

fn read_from_keyring(provider_id: &str) -> Result<Option<String>, String> {
    match keyring_entry(provider_id)?.get_password() {
        Ok(s) => Ok(Some(s)),
        Err(Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

fn delete_from_keyring(provider_id: &str) -> Result<(), String> {
    match keyring_entry(provider_id)?.delete_credential() {
        Ok(()) => Ok(()),
        Err(Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

fn remove_local_key(provider_id: &str) -> Result<(), String> {
    let mut lv = read_local_vault()?;
    if lv.keys.remove(provider_id).is_none() {
        return Ok(());
    }
    write_local_vault(&lv)
}

fn store_in_local_vault(provider_id: &str, api_key: &str) -> Result<(), String> {
    let mut lv = read_local_vault()?;
    lv.keys.insert(provider_id.to_string(), api_key.to_string());
    write_local_vault(&lv)
}

fn read_from_local_vault(provider_id: &str) -> Result<Option<String>, String> {
    let lv = read_local_vault()?;
    Ok(lv.keys.get(provider_id).cloned())
}

/// 将本地明文 vault 中的 Key 迁入系统凭据，并删除明文副本。
fn migrate_local_key_to_keyring(provider_id: &str, api_key: &str) {
    if store_in_keyring(provider_id, api_key).is_ok() {
        let _ = remove_local_key(provider_id);
    }
}

/// 应用启动时一次性迁移：避免旧版本留下的 api-keys.json 长期明文驻留。
pub fn migrate_plaintext_vault_to_keyring() {
    let Ok(mut lv) = read_local_vault() else {
        return;
    };
    if !lv.keys.is_empty() {
        let pending: Vec<(String, String)> = lv.keys.drain().collect();
        for (provider_id, api_key) in pending {
            if store_in_keyring(&provider_id, &api_key).is_ok() {
                continue;
            }
            lv.keys.insert(provider_id, api_key);
        }
        let _ = write_local_vault(&lv);
    }

    // Dev 启动：将旧版共享明文文件中尚未存在于 dev 命名空间的 Key 导入（不删除源文件）。
    if !is_dev_profile() {
        return;
    }
    let legacy_path = legacy_shared_local_vault_path();
    let Ok(legacy) = read_local_vault_at(&legacy_path) else {
        return;
    };
    for (provider_id, api_key) in legacy.keys {
        let already = read_from_keyring(&provider_id)
            .ok()
            .flatten()
            .is_some()
            || read_from_local_vault(&provider_id)
                .ok()
                .flatten()
                .is_some();
        if already {
            continue;
        }
        let _ = store_api_key(&provider_id, &api_key);
    }
}

pub fn store_api_key(provider_id: &str, api_key: &str) -> Result<(), String> {
    match store_in_keyring(provider_id, api_key) {
        Ok(()) => {
            // 系统凭据成功：不再写明文副本；并清理历史遗留明文。
            let _ = remove_local_key(provider_id);
            Ok(())
        }
        Err(keyring_err) => {
            store_in_local_vault(provider_id, api_key).map_err(|local_err| {
                format!(
                    "系统凭据写入失败：{}；本地兜底写入失败：{}",
                    keyring_err, local_err
                )
            })
        }
    }
}

pub fn get_api_key(provider_id: &str) -> Result<Option<String>, String> {
    // 仅供 debug / 集成测试注入假 Key；release 构建忽略此环境变量。
    #[cfg(any(test, debug_assertions))]
    if let Ok(k) = std::env::var("CANVASFLOW_TEST_API_KEY") {
        let k = k.trim().to_string();
        if !k.is_empty() {
            let _ = provider_id;
            return Ok(Some(k));
        }
    }

    match read_from_keyring(provider_id) {
        Ok(Some(v)) => return Ok(Some(v)),
        Ok(None) => {}
        Err(keyring_err) => {
            if let Ok(Some(v)) = read_from_local_vault(provider_id) {
                migrate_local_key_to_keyring(provider_id, &v);
                return Ok(Some(v));
            }
            return Err(keyring_err);
        }
    }

    if let Some(v) = read_from_local_vault(provider_id)? {
        migrate_local_key_to_keyring(provider_id, &v);
        return Ok(Some(v));
    }

    Ok(None)
}

pub fn delete_api_key(provider_id: &str) -> Result<(), String> {
    let local_err = remove_local_key(provider_id).err();
    match delete_from_keyring(provider_id) {
        Ok(()) => {
            if let Some(le) = local_err {
                Err(le)
            } else {
                Ok(())
            }
        }
        Err(keyring_err) => {
            if let Some(le) = local_err {
                Err(format!("系统凭据删除失败：{}；本地删除失败：{}", keyring_err, le))
            } else {
                Err(keyring_err)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dev_profile_uses_isolated_namespace() {
        assert!(is_dev_profile());
        assert_eq!(keyring_service(), "com.canvasflow.studio.dev");
        assert_eq!(local_data_dir_name(), "canvasflow-dev");
    }

    #[test]
    fn local_vault_path_lives_under_profile_dir() {
        let path = local_vault_path().expect("path");
        let parent = path.parent().expect("parent");
        assert_eq!(parent.file_name().and_then(|s| s.to_str()), Some(local_data_dir_name()));
        assert_eq!(path.file_name().and_then(|s| s.to_str()), Some("api-keys.json"));
    }

    #[test]
    fn write_local_vault_removes_file_when_empty() {
        let path = local_vault_path().expect("path");
        write_local_vault(&LocalVaultFile {
            keys: HashMap::from([("p1".into(), "secret".into())]),
        })
        .expect("write");
        assert!(path.exists());

        write_local_vault(&LocalVaultFile::default()).expect("clear");
        assert!(!path.exists());
    }
}
