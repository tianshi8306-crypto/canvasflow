import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { IMAGE_MODEL_OPTIONS } from "@/lib/imageGeneration/catalog";
import type { AppSettings, ImageModelConfig } from "@/lib/settingsPanelTypes";
import {
  imageModelEstimateLabel,
  imageModelIconLetter,
  imageModelSubtitle,
} from "@/lib/imageGeneration/imageModelDisplay";

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

function buildBuiltinImageModels(): ImageModelOption[] {
  return IMAGE_MODEL_OPTIONS.map((m, sortIndex) => ({
    id: m.id,
    label: m.label,
    subtitle: undefined,
    estimateLabel: "30s",
    iconLetter: (m.label.trim() || m.id).charAt(0).toUpperCase(),
    sortIndex,
    settingsId: null,
    model: m.id,
    priority: 0,
    enabled: true,
    supportsMultiRefFusion: true,
    maxReferenceImages: 4,
    supportsImageEdit: true,
  }));
}

function normalizeImageModels(configs: ImageModelConfig[]): ImageModelOption[] {
  return (configs ?? []).map((m, sortIndex) => ({
    id: `custom:${m.id}`,
    label: m.label?.trim() || m.model?.trim() || m.id,
    subtitle: imageModelSubtitle(m),
    estimateLabel: imageModelEstimateLabel(m),
    iconLetter: imageModelIconLetter(m),
    sortIndex: sortIndex + IMAGE_MODEL_OPTIONS.length,
    settingsId: m.id,
    model: m.model,
    priority: m.priority,
    enabled: m.enabled,
    supportsMultiRefFusion: m.supportsMultiRefFusion !== false,
    maxReferenceImages: Math.min(4, Math.max(1, m.maxReferenceImages ?? 4)),
    supportsImageEdit: m.supportsImageEdit !== false,
  }));
}

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
    setModels(merged);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await invoke<AppSettings>("load_settings");
      mergeModels(normalizeImageModels(raw.imageModels ?? []));
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