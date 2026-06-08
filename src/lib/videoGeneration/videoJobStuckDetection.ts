import { isDreaminaModel } from "@/lib/dreamina/model";

/** 进度数值长时间不变时的轮询次数上限（仅在有 progress 时生效） */
export const MAX_STUCK_POLLS_WITH_PROGRESS = 60;

/** 无进度字段时的最长等待（视频生成常见 5–20 分钟） */
export const MAX_VIDEO_JOB_WALL_CLOCK_MS = 45 * 60 * 1000;

export type StuckTrackState = {
  lastStatus?: string;
  lastProgress?: number;
  progressPlateauPolls: number;
};

export function stuckVideoJobErrorMessage(modelId: string | undefined): string {
  if (isDreaminaModel(modelId)) {
    return "视频生成超时，长时间无状态更新（可在即梦网页端确认后使用「取回成片」）";
  }
  return "视频生成超时，长时间无状态更新（请在服务商控制台确认任务状态）";
}

export function shouldFailVideoJobAsStuck(params: {
  prev: StuckTrackState | undefined;
  status: string;
  progress: number | undefined;
  jobStartedAtMs: number;
  nowMs: number;
}): { fail: boolean; next: StuckTrackState } {
  const { prev, status, progress, jobStartedAtMs, nowMs } = params;
  const base: StuckTrackState = prev ?? { progressPlateauPolls: 0 };

  if (nowMs - jobStartedAtMs >= MAX_VIDEO_JOB_WALL_CLOCK_MS) {
    return { fail: true, next: base };
  }

  const sameStatus = status === base.lastStatus;
  const hasProgress = progress != null && Number.isFinite(progress);

  // 供应商常不返回 progress；null/undefined 不应触发「无变化」计数
  if (hasProgress && sameStatus && progress === base.lastProgress) {
    const progressPlateauPolls = base.progressPlateauPolls + 1;
    const next: StuckTrackState = {
      lastStatus: status,
      lastProgress: progress,
      progressPlateauPolls,
    };
    return { fail: progressPlateauPolls >= MAX_STUCK_POLLS_WITH_PROGRESS, next };
  }

  return {
    fail: false,
    next: {
      lastStatus: status,
      lastProgress: hasProgress ? progress : base.lastProgress,
      progressPlateauPolls: 0,
    },
  };
}
