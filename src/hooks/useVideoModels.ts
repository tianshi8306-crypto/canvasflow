import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { VIDEO_BUILTIN_MODEL_OPTIONS } from "@/lib/videoGeneration/catalog";
import type { AppSettings } from "@/lib/settingsPanelTypes";
import type { ImageModelConfig } from "@/lib/settingsPanelTypes";

export type VideoModelOption = {
  /** 提交生成用的 model 标识（与 draft.modelId 一致） */
  id: string;
  /** 展示名 */
  label: string;
  /** Settings 中的配置 id；内置模型为 null */
  settingsId: string | null;
  enabled: boolean;
};

function buildBuiltinVideoModels(): VideoModelOption[] {
  return VIDEO_BUILTIN_MODEL_OPTIONS.map((m) => ({
    id: m.id,
    label: m.label,
    settingsId: null,
    enabled: true,
  }));
}

function normalizeVideoModels(configs: ImageModelConfig[]): VideoModelOption[] {
  return (configs ?? []).map((m) => ({
    id: m.model.trim() || m.id,
    label: m.label?.trim() || m.model?.trim() || m.id,
    settingsId: m.id,
    enabled: m.enabled,
  }));
}

/**
 * 动态读取视频模型（内置 Doubao / 即梦 CLI + 设置中的自定义项）
 */
export function useVideoModels() {
  const [models, setModels] = useState<VideoModelOption[]>([]);
  const [loading, setLoading] = useState(true);

  const mergeModels = useCallback((custom: VideoModelOption[]) => {
    const builtins = buildBuiltinVideoModels();
    const customIds = new Set(custom.map((m) => m.id.trim()).filter(Boolean));
    setModels([...builtins.filter((b) => !customIds.has(b.id)), ...custom]);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await invoke<AppSettings>("load_settings");
      mergeModels(normalizeVideoModels(raw.videoModels ?? []));
    } catch {
      mergeModels([]);
    } finally {
      setLoading(false);
    }
  }, [mergeModels]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** 第一个启用且有值的模型 */
  const defaultModel = models.find((m) => m.enabled && m.id) ?? null;

  return { models, loading, reload, defaultModel };
}
