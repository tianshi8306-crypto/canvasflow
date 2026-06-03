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
  return normalizeDreaminaCliModelVersion(rest);
}

/** CLI 接受的 model_version 别名（image2video help 中的 3.0_fast 等） */
export function normalizeDreaminaCliModelVersion(version: string): string {
  switch (version.trim().toLowerCase()) {
    case "3.0_fast":
      return "3.0fast";
    case "3.0_pro":
      return "3.0pro";
    case "3.5_pro":
      return "3.5pro";
    default:
      return version.trim();
  }
}
