import { invoke } from "@tauri-apps/api/core";
import { isDreaminaModel } from "@/lib/dreamina/model";
import { normalizeLoadedSettings } from "@/lib/settingsPanelState";
import { verifyApiKeyWithRetry } from "@/lib/settingsApiKeyVerify";
import { listMatchingEnabledVideoModelConfigs } from "@/lib/videoModelMerge";
import type { ImageModelConfig } from "@/lib/settingsPanelTypes";

/** 在多个 Settings 项映射到同一 modelId 时，优先返回已保存 API Key 的项 */
export async function findVideoModelConfigWithKey(
  configs: ImageModelConfig[],
  modelId: string,
): Promise<ImageModelConfig | null> {
  const matches = listMatchingEnabledVideoModelConfigs(configs, modelId);
  for (const cfg of matches) {
    try {
      const ok = await verifyApiKeyWithRetry(`video-model:${cfg.id}`, 3);
      if (ok) return cfg;
    } catch {
      // 凭据读回偶发失败，继续尝试其它匹配项
    }
  }
  return matches[0] ?? null;
}

/** 提交生成前检查：Settings 中已启用且（非即梦时）已配置 API Key */
export async function getVideoModelReadinessError(modelId: string): Promise<string | null> {
  const id = modelId.trim();
  if (!id) return "请选择视频模型";

  if (isDreaminaModel(id)) return null;

  let settings;
  try {
    settings = normalizeLoadedSettings(await invoke("load_settings"));
  } catch {
    return "无法读取应用设置，请重试";
  }

  const matches = listMatchingEnabledVideoModelConfigs(settings.videoModels ?? [], id);
  if (matches.length === 0) {
    return `视频模型「${id}」未在设置中启用。请打开 设置 → 视频模型，确认「模型标识」与所选模型一致并已启用`;
  }

  const cfgWithKey = await findVideoModelConfigWithKey(settings.videoModels ?? [], id);
  if (cfgWithKey) {
    try {
      const hasKey = await verifyApiKeyWithRetry(`video-model:${cfgWithKey.id}`, 3);
      if (hasKey) return null;
    } catch {
      return "无法检查视频模型 API Key";
    }
  }

  const label = matches.find((m) => m.label?.trim())?.label?.trim() || id;
  return `请为「${label}」在 设置 → 视频模型 中填写 API Key 后保存`;
}
