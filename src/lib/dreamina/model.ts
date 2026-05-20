/**
 * 即梦 CLI 模型识别（与 settings / providers 中 dreamina/* 标识对齐）
 */

export function isDreaminaModel(modelId: string | null | undefined): boolean {
  const m = (modelId ?? "").trim().toLowerCase();
  return m === "dreamina" || m.startsWith("dreamina/");
}

/** 从 dreamina/4.5 等形式解析 CLI --model_version */
export function dreaminaModelVersion(modelId: string): string | undefined {
  const rest = modelId.trim().replace(/^dreamina\//i, "");
  if (!rest) return undefined;
  const lower = rest.toLowerCase();
  if (
    lower === "text2image" ||
    lower === "image2image" ||
    lower === "text2video" ||
    lower === "image2video" ||
    lower === "frames2video" ||
    lower === "multimodal2video"
  ) {
    return undefined;
  }
  return rest;
}
