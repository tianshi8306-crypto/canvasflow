import { useEffect, useRef } from "react";
import {
  listVideoNodesWithActiveJobs,
  pollVideoNodeJobOnce,
} from "@/lib/videoGeneration/videoNodeJobPoll";
import { useProjectStore } from "@/store/projectStore";

/** 排队阶段轮询间隔 */
const POLL_INTERVAL_QUEUED_MS = 1200;
/** 生成中阶段轮询间隔（更密，成片返回更快） */
const POLL_INTERVAL_RUNNING_MS = 500;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const t = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

function pollIntervalForStatus(status: string | undefined): number {
  return status === "running" ? POLL_INTERVAL_RUNNING_MS : POLL_INTERVAL_QUEUED_MS;
}

async function runVideoNodePollLoop(videoNodeId: string, signal: AbortSignal): Promise<void> {
  // 提交后立刻连查几次，缩短「网页已好、本地还排队」的空窗
  const burstDelays = [0, 350, 700];
  for (const delay of burstDelays) {
    if (signal.aborted) return;
    if (delay > 0) {
      try {
        await sleep(delay, signal);
      } catch {
        return;
      }
    }
    const node = useProjectStore.getState().nodes.find((n) => n.id === videoNodeId);
    const st = node?.data.video?.activeJob?.status;
    if (st !== "queued" && st !== "running") return;
    const outcome = await pollVideoNodeJobOnce(videoNodeId);
    if (outcome !== "pending") return;
  }

  while (!signal.aborted) {
    const node = useProjectStore.getState().nodes.find((n) => n.id === videoNodeId);
    const job = node?.data.video?.activeJob;
    if (!job?.id) return;
    const st = job.status;
    if (st !== "queued" && st !== "running") return;

    const outcome = await pollVideoNodeJobOnce(videoNodeId);
    if (outcome !== "pending") return;

    const after = useProjectStore.getState().nodes.find((n) => n.id === videoNodeId);
    const nextStatus = after?.data.video?.activeJob?.status;
    try {
      await sleep(pollIntervalForStatus(nextStatus), signal);
    } catch {
      return;
    }
  }
}

/**
 * 工程级视频任务轮询：每个节点独立循环，不互相阻塞；打开工程后自动恢复轮询。
 */
export function useProjectVideoJobPolling() {
  const projectPath = useProjectStore((s) => s.projectPath);
  const nodes = useProjectStore((s) => s.nodes);
  const loopsRef = useRef<Map<string, AbortController>>(new Map());

  const activeNodeIds = listVideoNodesWithActiveJobs(nodes);
  const activeKey = activeNodeIds.join(",");

  useEffect(() => {
    if (!projectPath) {
      for (const ac of loopsRef.current.values()) {
        ac.abort();
      }
      loopsRef.current.clear();
      return;
    }

    const loops = loopsRef.current;
    const activeSet = new Set(activeNodeIds);

    for (const id of activeSet) {
      if (loops.has(id)) continue;
      const ac = new AbortController();
      loops.set(id, ac);
      void runVideoNodePollLoop(id, ac.signal).finally(() => {
        if (loops.get(id) === ac) {
          loops.delete(id);
        }
      });
    }

    for (const [id, ac] of [...loops.entries()]) {
      if (!activeSet.has(id)) {
        ac.abort();
        loops.delete(id);
      }
    }
  }, [projectPath, activeKey]);
}
