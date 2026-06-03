import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  buildBuiltinImageModels,
  normalizeImageModelsFromSettings,
} from "@/lib/imageGeneration/imageModelOptions";
import type { AppSettings } from "@/lib/settingsPanelTypes";

export type ImageModelOption = {
  /** 唯一标识：custom:${id} 表示自定义模型 */
  id: string;
  /** 展示名 */
  label: string;
  /** 副标题（厂商 / 变体） */
  subtitle?: string;
  /** 预估耗时展示，如 30s */
  estimateLabel: string;
  /** 列表图标首字母 */
  iconLetter: string;
  /** 设置中的添加顺序（0 起） */
  sortIndex: number;
  /** Settings 中对应的 id */
  settingsId: string | null;
  /** API 模型标识 */
  model: string;
  /** 优先级 */
  priority: number;
  enabled: boolean;
  supportsMultiRefFusion: boolean;
  maxReferenceImages: number;
  supportsImageEdit: boolean;
};

/**
 * 动态读取图片模型（含内置 + 用户在设置中配置的自定义模型）
 */
export function useImageModels() {
  const [models, setModels] = useState<ImageModelOption[]>([]);
  const [loading, setLoading] = useState(true);

  const mergeModels = useCallback((custom: ImageModelOption[]) => {
    const builtins = buildBuiltinImageModels();
    const customModelIds = new Set(custom.map((m) => m.model.trim()).filter(Boolean));
    const merged = [
      ...builtins.filter((b) => !customModelIds.has(b.model)),
      ...custom,
    ];
    merged.sort((a, b) => a.priority - b.priority || a.sortIndex - b.sortIndex);
    setModels(merged);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await invoke<AppSettings>("load_settings");
      mergeModels(normalizeImageModelsFromSettings(raw.imageModels ?? []));
    } catch {
      mergeModels([]);
    } finally {
      setLoading(false);
    }
  }, [mergeModels]);

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