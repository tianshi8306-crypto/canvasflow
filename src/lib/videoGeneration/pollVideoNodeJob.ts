import { getVideoJobViaBridge } from "@/lib/videoGeneration";
import { defaultVideoNodePersisted } from "@/lib/videoNodeTypes";
import { useProjectStore } from "@/store/projectStore";

export type VideoJobPollOutcome = "succeeded" | "failed" | "cancelled" | "idle" | "timeout";

const DEFAULT_INTERVAL_MS = 1500;
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
  const { projectPath, updateNodeData, setStatusText } = useProjectStore.getState();

  const tick = async (): Promise<VideoJobPollOutcome | "pending"> => {
    const node = useProjectStore.getState().nodes.find((n) => n.id === videoNodeId);
    const vb = node?.data.video ?? defaultVideoNodePersisted();
    const job = vb.activeJob;
    if (!job?.id) {
      if (node?.data.path?.trim() || node?.data.assetId?.trim()) return "succeeded";
      return "idle";
    }
    if (job.status !== "queued" && job.status !== "running") {
      if (job.status === "failed" || job.status === "cancelled") return job.status;
      if (node?.data.path?.trim()) return "succeeded";
      return "failed";
    }

    try {
      const snap = await getVideoJobViaBridge(job.id);
      if (snap.status === "queued" || snap.status === "running") {
        const polledProgress =
          typeof snap.progress === "number" && Number.isFinite(snap.progress)
            ? Math.round(Math.min(99, Math.max(0, snap.progress)))
            : undefined;
        updateNodeData(videoNodeId, {
          video: {
            ...vb,
            activeJob: {
              id: snap.id,
              status: snap.status,
              progress: snap.progress,
              modelId: snap.modelId,
              error: snap.error ?? null,
              startedAt: vb.activeJob?.startedAt,
            },
          },
          ...(polledProgress != null
            ? {
                status: {
                  status: "running" as const,
                  updatedAt: Date.now(),
                  agentName: "视频",
                  phase: "poll",
                  progress: polledProgress,
                },
              }
            : {}),
        });
        return "pending";
      }

      if (snap.status === "succeeded") {
        const rel = snap.resultRelPath?.trim();
        updateNodeData(videoNodeId, {
          ...(rel ? { path: rel } : {}),
          status: undefined,
          video: {
            ...vb,
            source: "generation",
            activeJob: undefined,
          },
        });
        return "succeeded";
      }

      updateNodeData(videoNodeId, {
        status: undefined,
        video: {
          ...vb,
          activeJob: {
            id: snap.id,
            status: snap.status,
            modelId: snap.modelId,
            error: snap.error ?? "任务失败",
          },
        },
      });
      return snap.status === "cancelled" ? "cancelled" : "failed";
    } catch (e) {
      if (projectPath) {
        setStatusText(`轮询视频任务失败：${e instanceof Error ? e.message : String(e)}`);
      }
      return "failed";
    }
  };

  for (;;) {
    const outcome = await tick();
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
