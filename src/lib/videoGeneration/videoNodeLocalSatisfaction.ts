import type { VideoNodePersisted } from "@/lib/videoNodeTypes";

export type VideoNodeLocalCheckInput = {
  path?: string;
  assetId?: string;
  video?: {
    awaitingNewResult?: boolean;
    activeJob?: { status?: string };
  };
};

/** 节点是否已有可预览的本地视频（path 或 assetId） */
export function nodeHasLocalVideo(node: VideoNodeLocalCheckInput): boolean {
  return Boolean(node.path?.trim() || node.assetId?.trim());
}

/** 用户刚提交了新任务，旧成片仍显示在预览上，需继续轮询直至替换 */
export function isAwaitingNewVideoResult(
  video?: { awaitingNewResult?: boolean },
): boolean {
  return Boolean(video?.awaitingNewResult);
}

/**
 * 本地已有成片且并非「重新生成替换中」：无需连远端、无需再下载。
 */
export function nodeHasSatisfiedLocalVideo(node: VideoNodeLocalCheckInput): boolean {
  return nodeHasLocalVideo(node) && !isAwaitingNewVideoResult(node.video);
}

export function isActiveVideoJobInProgress(
  active?: { status?: string } | null,
): boolean {
  const st = active?.status;
  return st === "queued" || st === "running";
}

/** 清除过期 activeJob 的 video 块补丁（保留其余字段） */
export function patchClearStaleActiveJob(video: VideoNodePersisted): VideoNodePersisted {
  return {
    ...video,
    awaitingNewResult: false,
    activeJob: undefined,
  };
}
