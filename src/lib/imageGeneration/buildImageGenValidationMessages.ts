import type { ImageTaskMode } from "@/lib/imageGeneration/catalog";

/**
 * 状态轨校验文案：仅展示「禁用生成钮仍不够明确」的情况。
 * 空 prompt / 无工程 / 无 task 等由生成钮 disabled 表达，不再占一行提示。
 */
export function buildImageGenValidationMessages(input: {
  projectPath: string | null;
  blockReason: string | null;
  effectivePromptText: string;
  task: ImageTaskMode | null | undefined;
  validModelId: string;
  modelsLoading: boolean;
}): string[] {
  if (input.blockReason) {
    return [input.blockReason];
  }

  if (!input.modelsLoading && !input.validModelId) {
    return ["未配置可用的图片模型。请在 设置 → 图片模型 中启用并配置 API Key"];
  }

  return [];
}

/** 生成钮是否可点（与状态轨展示解耦） */
export function canStartImageGeneration(input: {
  projectPath: string | null;
  blockReason: string | null;
  effectivePromptText: string;
  task: ImageTaskMode | null | undefined;
  validModelId: string;
  modelsLoading: boolean;
  isGenerating: boolean;
}): boolean {
  if (!input.projectPath || input.isGenerating) return false;
  if (input.blockReason) return false;
  if (!input.effectivePromptText.trim()) return false;
  if (!input.task) return false;
  if (!input.modelsLoading && !input.validModelId) return false;
  return true;
}
