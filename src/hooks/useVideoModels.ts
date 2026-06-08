import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppSettings } from "@/lib/settingsPanelTypes";
import { normalizeLoadedSettings } from "@/lib/settingsPanelState";
import { mergeVideoModelOptionsFromSettings, listMatchingEnabledVideoModelConfigs } from "@/lib/videoModelMerge";
import { isDreaminaModel } from "@/lib/dreamina/model";

export type VideoModelOption = {
  /** 提交生成用的 model 标识（与 draft.modelId 一致） */
  id: string;
  /** 展示名 */
  label: string;
  /** Settings 中的配置 id；即梦 CLI 等内置项为 null */
  settingsId: string | null;
  enabled: boolean;
  /** 不可选原因（设置未启用等；API Key 缺失仅作提示，不阻断下拉） */
  disabledReason?: string;
};

/** 下拉列表：仅反映设置中的启用状态；API Key 在点击生成时再校验 */
function enrichVideoModelOptions(
  models: VideoModelOption[],
  settingsConfigs: AppSettings["videoModels"],
): VideoModelOption[] {
  const out: VideoModelOption[] = [];
  for (const m of models) {
    if (!m.enabled) {
      out.push({ ...m, disabledReason: "未在设置中启用" });
      continue;
    }
    if (isDreaminaModel(m.id)) {
      out.push(m);
      continue;
    }
    const matches = listMatchingEnabledVideoModelConfigs(settingsConfigs ?? [], m.id);
    if (matches.length === 0) {
      out.push({
        ...m,
        enabled: false,
        disabledReason: `视频模型「${m.id}」未在设置中启用`,
      });
      continue;
    }
    out.push(m);
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
      const videoModels = settings.videoModels ?? [];
      const merged = mergeVideoModelOptionsFromSettings(videoModels);
      setModels(enrichVideoModelOptions(merged, videoModels));
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
