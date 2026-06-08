import { pollVideoNodeJobOnce, type VideoNodePollResult } from "@/lib/videoGeneration/videoNodeJobPoll";

export type VideoJobPollOutcome = VideoNodePollResult | "timeout";

const DEFAULT_INTERVAL_MS = 800;
const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000;

/**
 * 轮询单个视频节点的 activeJob，直至成功落盘、失败或超时（不依赖节点是否挂载在画布上）。
 */
export async function pollVideoNodeJobUntilSettled(
  videoNodeId: string,
  opts?: { intervalMs?: number; timeoutMs?: number },
): Promise<VideoJobPollOutcome> {
  const intervalMs = opts?.intervalMs ?? DEFAULT_INTERVAL_MS;
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startedAt = Date.now();

  for (;;) {
    const outcome = await pollVideoNodeJobOnce(videoNodeId);
    if (outcome !== "pending") return outcome;
    if (Date.now() - startedAt >= timeoutMs) return "timeout";
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

export type BatchVideoWaitResult = {
  succeeded: string[];
  failed: string[];
  timedOut: string[];
};

export async function waitForVideoNodesJobs(
  videoNodeIds: string[],
  opts?: {
    timeoutMs?: number;
    onProgress?: (done: number, total: number) => void;
  },
): Promise<BatchVideoWaitResult> {
  const total = videoNodeIds.length;
  const succeeded: string[] = [];
  const failed: string[] = [];
  const timedOut: string[] = [];

  for (let i = 0; i < videoNodeIds.length; i++) {
    const id = videoNodeIds[i]!;
    opts?.onProgress?.(i, total);
    const outcome = await pollVideoNodeJobUntilSettled(id, { timeoutMs: opts?.timeoutMs });
    if (outcome === "succeeded" || outcome === "idle") {
      succeeded.push(id);
    } else if (outcome === "timeout") {
      timedOut.push(id);
    } else {
      failed.push(id);
    }
    opts?.onProgress?.(i + 1, total);
  }

  return { succeeded, failed, timedOut };
}
