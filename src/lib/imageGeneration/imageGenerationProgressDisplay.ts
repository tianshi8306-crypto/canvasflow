export type ImageGenerationProgressInput = {
  status?: string | null;
  progress?: number | null;
  cancelling?: boolean;
};

function normalizeImageGenProgress(progress: number | null | undefined): number | undefined {
  if (progress == null || Number.isNaN(progress)) return undefined;
  if (progress > 0 && progress <= 1) return Math.round(progress * 100);
  if (progress >= 0 && progress <= 99) return Math.round(progress);
  return undefined;
}

export function getImageGenerationProgressPercent(
  input: ImageGenerationProgressInput,
): number | undefined {
  return normalizeImageGenProgress(input.progress);
}

export function isImageGenerationInProgress(input: ImageGenerationProgressInput): boolean {
  if (input.cancelling) return true;
  return input.status === "pending" || input.status === "running";
}

/** 分阶段文案：无真实 progress 时不显示假数字 */
export function getImageGenerationDisplayLabel(input: ImageGenerationProgressInput): string {
  if (input.cancelling) return "停止中…";

  const percent = getImageGenerationProgressPercent(input);
  const status = input.status;

  if (status === "pending") {
    return percent != null ? `准备中 ${percent}%…` : "准备中…";
  }
  if (status === "running") {
    return percent != null ? `正在生成图片 ${percent}%…` : "正在生成图片…";
  }
  return "正在生成图片…";
}
