import { normalizeVideoJobProgress } from "@/lib/video/normalizeVideoJobProgress";

export type VideoJobStatusLike = "queued" | "running" | "succeeded" | "failed" | "cancelled" | string;

export type VideoGenerationProgressInput = {
  status?: VideoJobStatusLike | null;
  progress?: number | null;
  cancelling?: boolean;
};

/** 仅当后端/API 返回有效 progress 时才给出 0~99 整数百分比 */
export function getVideoGenerationProgressPercent(
  input: VideoGenerationProgressInput,
): number | undefined {
  return normalizeVideoJobProgress(input.progress);
}

export function isVideoGenerationInProgress(input: VideoGenerationProgressInput): boolean {
  if (input.cancelling) return true;
  return input.status === "queued" || input.status === "running";
}

/** 分阶段文案：无真实 progress 时不显示假数字 */
export function getVideoGenerationDisplayLabel(input: VideoGenerationProgressInput): string {
  if (input.cancelling) return "取消中…";

  const percent = getVideoGenerationProgressPercent(input);
  const status = input.status;

  if (status === "queued") {
    return percent != null ? `排队中 ${percent}%…` : "排队中…";
  }
  if (status === "running") {
    return percent != null ? `生成中 ${percent}%…` : "生成中…";
  }
  return "生成中…";
}
