import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppSettings } from "@/lib/settingsPanelTypes";
import { applyAppSettingsToCanvasUi } from "@/lib/canvasSettingsSync";
import { normalizeLoadedSettings } from "@/lib/settingsPanelState";

async function syncFromSettings() {
  try {
    const raw = await invoke<AppSettings>("load_settings");
    applyAppSettingsToCanvasUi(normalizeLoadedSettings(raw));
  } catch {
    /* 浏览器预览或无设置文件时使用 store 默认值 */
  }
}

/** 启动时与设置保存后同步画布吸附/网格/连线等偏好 */
export function useCanvasSettingsSync() {
  useEffect(() => {
    void syncFromSettings();
    const onSaved = () => void syncFromSettings();
    window.addEventListener("canvasflow-settings-saved", onSaved);
    return () => window.removeEventListener("canvasflow-settings-saved", onSaved);
  }, []);
}
