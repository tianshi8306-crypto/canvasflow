import { isDreaminaModel } from "@/lib/dreamina/model";
import { VIDEO_BUILTIN_MODEL_OPTIONS } from "@/lib/videoGeneration/catalog";
import { isDoubaoSeedancePreset, DOUBAO_SEEDANCE_CANONICAL_ID } from "@/lib/videoGeneration/seedanceApiModel";
import type { VideoModelOption } from "@/hooks/useVideoModels";
import type { AppSettings, ImageModelConfig } from "@/lib/settingsPanelTypes";

/** 下拉 / draft.modelId 用的稳定标识（与 catalog 一致，不等于 API 接入点 model） */
export function videoModelOptionId(m: ImageModelConfig): string {
  if (isDoubaoSeedancePreset(m)) return DOUBAO_SEEDANCE_CANONICAL_ID;
  return (m.model.trim() || m.id).trim();
}

function modelConfigId(m: ImageModelConfig): string {
  return videoModelOptionId(m);
}

/** Settings 项是否与画布所选 modelId 对应 */
export function videoModelConfigMatches(m: ImageModelConfig, modelId: string): boolean {
  const id = modelId.trim();
  if (!id) return false;
  const model = m.model.trim();
  return model === id || m.id === id || videoModelOptionId(m) === id;
}

/** Settings 项 + 即梦 CLI 内置（不走 Ark API Key；用户若在设置里禁用则不再注入） */
export function mergeVideoModelOptionsFromSettings(
  configs: ImageModelConfig[],
): VideoModelOption[] {
  const fromSettings: VideoModelOption[] = (configs ?? []).map((m) => ({
    id: modelConfigId(m),
    label: m.label?.trim() || m.model?.trim() || m.id,
    settingsId: m.id,
    enabled: m.enabled,
  }));

  const byId = new Map(fromSettings.map((m) => [m.id, m]));

  for (const builtin of VIDEO_BUILTIN_MODEL_OPTIONS) {
    if (!isDreaminaModel(builtin.id)) continue;
    const existing = byId.get(builtin.id);
    if (existing) continue;
    const disabledInSettings = (configs ?? []).some(
      (m) => modelConfigId(m) === builtin.id && !m.enabled,
    );
    if (disabledInSettings) continue;
    const opt: VideoModelOption = {
      id: builtin.id,
      label: builtin.label,
      settingsId: null,
      enabled: true,
    };
    byId.set(builtin.id, opt);
  }

  const settingsOrder = fromSettings.map((m) => m.id);
  const appended = [...byId.keys()].filter((id) => !settingsOrder.includes(id));
  return [...settingsOrder, ...appended].map((id) => byId.get(id)!);
}

/** 提交生成时视为可用的 modelId（含即梦 CLI） */
export function listSelectableVideoModelIds(settings: AppSettings): string[] {
  return mergeVideoModelOptionsFromSettings(settings.videoModels ?? [])
    .filter((m) => m.enabled && m.id)
    .map((m) => m.id);
}
