import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppSettings } from "@/lib/settingsPanelTypes";
import { normalizeLoadedSettings } from "@/lib/settingsPanelState";
import { mergeVideoModelOptionsFromSettings } from "@/lib/videoModelMerge";
import { getVideoModelReadinessError } from "@/lib/videoModelReadiness";

export type VideoModelOption = {
  /** 提交生成用的 model 标识（与 draft.modelId 一致） */
  id: string;
  /** 展示名 */
  label: string;
  /** Settings 中的配置 id；即梦 CLI 等内置项为 null */
  settingsId: string | null;
  enabled: boolean;
  /** 不可选原因（如未配置 API Key） */
  disabledReason?: string;
};

async function enrichVideoModelReadiness(models: VideoModelOption[]): Promise<VideoModelOption[]> {
  const out: VideoModelOption[] = [];
  for (const m of models) {
    if (!m.enabled) {
      out.push({ ...m, disabledReason: "未在设置中启用" });
      continue;
    }
    const err = await getVideoModelReadinessError(m.id);
    if (err) {
      out.push({ ...m, enabled: false, disabledReason: err });
    } else {
      out.push(m);
    }
  }
  return out;
}

/**
 * 动态读取视频模型：Settings 已配置项 + 即梦 CLI 内置（Doubao 仅来自 Settings）
 */
export function useVideoModels() {
  const [models, setModels] = useState<VideoModelOption[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await invoke<AppSettings>("load_settings");
      const settings = normalizeLoadedSettings(raw);
      const merged = mergeVideoModelOptionsFromSettings(settings.videoModels ?? []);
      setModels(await enrichVideoModelReadiness(merged));
    } catch {
      setModels([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onSaved = () => void reload();
    window.addEventListener("canvasflow-settings-saved", onSaved);
    return () => window.removeEventListener("canvasflow-settings-saved", onSaved);
  }, [reload]);

  /** 第一个启用且有值的模型 */
  const defaultModel = models.find((m) => m.enabled && m.id) ?? null;

  return { models, loading, reload, defaultModel };
}
