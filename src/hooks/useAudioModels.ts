import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  mergeAudioModelOptions,
  normalizeAudioModelsFromSettings,
  type AudioModelOption,
} from "@/lib/audioModelOptions";
import type { AppSettings } from "@/lib/settingsPanelTypes";

export type { AudioModelOption };

export function useAudioModels() {
  const [models, setModels] = useState<AudioModelOption[]>([]);
  const [loading, setLoading] = useState(true);

  const merge = useCallback((custom: AudioModelOption[]) => {
    setModels(mergeAudioModelOptions(custom));
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await invoke<AppSettings>("load_settings");
      merge(normalizeAudioModelsFromSettings(raw.audioModels ?? []));
    } catch {
      merge([]);
    } finally {
      setLoading(false);
    }
  }, [merge]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onSaved = () => void reload();
    window.addEventListener("canvasflow-settings-saved", onSaved);
    return () => window.removeEventListener("canvasflow-settings-saved", onSaved);
  }, [reload]);

  const defaultModel = models.find((m) => m.enabled && m.id) ?? null;

  return { models, loading, reload, defaultModel };
}
