import { invoke } from "@tauri-apps/api/core";
import { isDreaminaModel } from "@/lib/dreamina/model";
import { normalizeLoadedSettings } from "@/lib/settingsPanelState";
import { videoModelConfigMatches } from "@/lib/videoModelMerge";

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

  const cfg = (settings.videoModels ?? []).find(
    (m) => m.enabled && videoModelConfigMatches(m, id),
  );
  if (!cfg) {
    return `视频模型「${id}」未在设置中启用。请打开 设置 → 视频模型，确认「模型标识」与所选模型一致并已启用`;
  }

  try {
    const hasKey = await invoke<boolean>("has_api_key", {
      providerId: `video-model:${cfg.id}`,
    });
    if (!hasKey) {
      return `请为「${cfg.label?.trim() || id}」在 设置 → 视频模型 中填写 API Key 后保存`;
    }
  } catch {
    return "无法检查视频模型 API Key";
  }

  return null;
}
