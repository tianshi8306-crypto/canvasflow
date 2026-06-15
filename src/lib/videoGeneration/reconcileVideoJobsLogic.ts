export type PersistedVideoJobEntry = {
  jobId: string;
  projectPath: string;
  nodeId: string;
  modelId: string;
  polls: number;
  resultRelPath?: string | null;
  cancelled: boolean;
  isDreamina: boolean;
  dreaminaWorkflow?: string | null;
  modifiedAtMs?: number;
};

import {
  isActiveVideoJobInProgress,
  nodeHasSatisfiedLocalVideo,
} from "@/lib/videoGeneration/videoNodeLocalSatisfaction";

export type VideoNodeReconcileInput = {
  id: string;
  data: {
    path?: string;
    assetId?: string;
    video?: {
      awaitingNewResult?: boolean;
      activeJob?: { id?: string; status?: string };
    };
  };
};

function pickLatestJob(jobs: PersistedVideoJobEntry[]): PersistedVideoJobEntry {
  return jobs.reduce((best, cur) => {
    const bestMs = best.modifiedAtMs ?? 0;
    const curMs = cur.modifiedAtMs ?? 0;
    if (curMs !== bestMs) return curMs > bestMs ? cur : best;
    return cur.polls >= best.polls ? cur : best;
  });
}

/** 同一节点多任务时：优先进行中任务，再按修改时间 / polls 选最新 */
export function pickDiskJobForNode(
  nodeId: string,
  entries: PersistedVideoJobEntry[],
): PersistedVideoJobEntry | null {
  const nodeJobs = entries.filter((e) => e.nodeId === nodeId && !e.cancelled);
  if (nodeJobs.length === 0) return null;

  const inProgress = nodeJobs.filter((e) => !e.resultRelPath?.trim());
  if (inProgress.length > 0) {
    return pickLatestJob(inProgress);
  }
  return pickLatestJob(nodeJobs);
}

export function isActiveVideoJobRunning(
  active?: { id?: string; status?: string } | null,
): boolean {
  if (!active?.id?.trim()) return false;
  return isActiveVideoJobInProgress(active);
}

/** 节点成片路径已与磁盘任务结果一致且无需再轮询 */
export function shouldSkipVideoJobReconcile(
  node: VideoNodeReconcileInput,
  diskJob: PersistedVideoJobEntry,
): boolean {
  const active = node.data.video?.activeJob;
  const nodePath = node.data.path?.trim() || "";
  const diskResult = diskJob.resultRelPath?.trim() || "";

  if (nodeHasSatisfiedLocalVideo(node.data)) {
    if (diskResult && nodePath !== diskResult) {
      return false;
    }
    if (!diskResult && diskJob.jobId !== active?.id?.trim()) {
      return false;
    }
    return true;
  }

  if (isActiveVideoJobRunning(active) && active!.id === diskJob.jobId) {
    // 磁盘已有成片但节点未写入 path 时仍需对账拉回预览
    if (diskResult && nodePath !== diskResult) {
      return false;
    }
    // 即梦 CLI 任务可能网页端已成功，本地仍显示排队 — 需 recover / 轮询
    if (
      diskJob.isDreamina &&
      !diskResult &&
      !nodePath &&
      isActiveVideoJobRunning(active)
    ) {
      return false;
    }
    return true;
  }
  if (diskResult && nodePath === diskResult && !isActiveVideoJobRunning(active)) {
    return true;
  }

  return false;
}

/** 内存中仍在轮询、但尚未写入 video-jobs 目录的任务，不应被磁盘旧任务覆盖 */
export function shouldKeepInMemoryActiveJob(
  node: VideoNodeReconcileInput,
  diskJob: PersistedVideoJobEntry,
  entries: PersistedVideoJobEntry[],
): boolean {
  const active = node.data.video?.activeJob;
  if (!isActiveVideoJobRunning(active) || !active?.id) return false;
  if (active.id === diskJob.jobId) return false;

  const onDisk = entries.some((e) => e.jobId === active.id && !e.cancelled);
  return !onDisk;
}

export function buildRestoredActiveJob(
  diskJob: PersistedVideoJobEntry,
  existingStartedAt?: string,
  fallbackModelId?: string,
): {
  id: string;
  status: "queued" | "running";
  modelId: string;
  startedAt: string;
} {
  const diskHasResult = Boolean(diskJob.resultRelPath?.trim());
  return {
    id: diskJob.jobId,
    status: diskHasResult ? "running" : "queued",
    modelId: diskJob.modelId || fallbackModelId || "doubao_seedance_2_0",
    startedAt: existingStartedAt ?? new Date().toISOString(),
  };
}
