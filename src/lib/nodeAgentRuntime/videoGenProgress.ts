import type { NodeAgentContext } from "@/lib/nodeAgentRuntime/types";

const TICK_MS = 380;

/** 视频任务轮询/提交期间平滑推进节点右上角进度（8% → 92%），对齐图片节点 */
export function startVideoGenProgressTicker(ctx: NodeAgentContext): () => void {
  let progress = 8;

  const push = (value: number) => {
    ctx.updateNodeData(ctx.nodeId, {
      status: {
        status: "running",
        updatedAt: Date.now(),
        agentName: "视频",
        phase: "poll",
        progress: Math.round(Math.min(99, Math.max(0, value))),
      },
    });
  };

  push(progress);
  const timer = window.setInterval(() => {
    if (ctx.cancelToken?.cancelled) return;
    progress = Math.min(92, progress + 2 + Math.random() * 6);
    push(progress);
  }, TICK_MS);

  return () => {
    window.clearInterval(timer);
  };
}
