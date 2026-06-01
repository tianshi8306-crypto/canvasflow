import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppSettings } from "@/lib/settingsPanelTypes";
import {
  normalizeProjectAutoSaveIdleSec,
} from "@/lib/projectAutoSaveSettings";
import { applyProjectAutoSaveIdleSec } from "@/store/projectSaveDebounce";
import { normalizeLoadedSettings } from "@/lib/settingsPanelState";

async function syncFromSettings() {
  try {
    const raw = await invoke<AppSettings>("load_settings");
    const settings = normalizeLoadedSettings(raw);
    applyProjectAutoSaveIdleSec(
      normalizeProjectAutoSaveIdleSec(settings.projectAutoSaveIdleSec),
    );
  } catch {
    applyProjectAutoSaveIdleSec(normalizeProjectAutoSaveIdleSec(undefined));
  }
}

/** 启动时与设置保存后同步画布自动保存防抖间隔 */
export function useProjectAutoSaveSettingsSync() {
  useEffect(() => {
    void syncFromSettings();
    const onSaved = () => void syncFromSettings();
    window.addEventListener("canvasflow-settings-saved", onSaved);
    return () => window.removeEventListener("canvasflow-settings-saved", onSaved);
  }, []);
}
