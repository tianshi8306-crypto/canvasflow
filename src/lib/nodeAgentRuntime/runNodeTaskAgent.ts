import { formatUserError } from "@/lib/errors";
import type { NodeAgentContext, NodeAgentPhase, NodeAgentRuntimeEvent, NodeTaskAgentRuntime } from "@/lib/nodeAgentRuntime/types";

function emitAgentEvent(
  ctx: NodeAgentContext,
  agentName: string,
  phase: NodeAgentPhase,
  startMs: number,
  error?: string,
) {
  const evt: NodeAgentRuntimeEvent = {
    agentName,
    nodeId: ctx.nodeId,
    projectPath: ctx.projectPath,
    phase,
    timestampMs: Date.now(),
    elapsedMs: Date.now() - startMs,
    ...(error ? { error } : {}),
  };
  ctx.reportAgentEvent?.(evt);
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new CustomEvent<NodeAgentRuntimeEvent>("node-agent-event", { detail: evt }));
  }
}

/**
 * 统一单任务 Agent 调度入口。
 * 感知输入 → 执行 → 结果校验 → 回写节点记忆体。
 * 返回 abort controller，可外部调用 cancel() 中止执行。
 */
export async function runNodeTaskAgent<TInput, TSensed, TExecuted, TCommitted>(
  runtime: NodeTaskAgentRuntime<TInput, TSensed, TExecuted, TCommitted>,
  input: TInput,
  ctx: NodeAgentContext,
): Promise<TCommitted> {
  const startMs = Date.now();
  const isVideoAgent = runtime.agentName === "视频 Agent";
  try {
    emitAgentEvent(ctx, runtime.agentName, "start", startMs);
    emitAgentEvent(ctx, runtime.agentName, "sense", startMs);
    const sensed = await runtime.sense(input, ctx);
    emitAgentEvent(ctx, runtime.agentName, "execute", startMs);
    const executed = await runtime.execute(sensed, ctx);
    emitAgentEvent(ctx, runtime.agentName, "validate", startMs);
    const committed = await runtime.validate(executed, ctx);
    emitAgentEvent(ctx, runtime.agentName, "commit", startMs);
    await runtime.commit(committed, ctx);
    emitAgentEvent(ctx, runtime.agentName, "end", startMs);

    // ★ 系统通知：非视频 Agent 完成（视频 Agent 由轮询回调独立处理）
    if (!isVideoAgent) {
      import("@/lib/systemNotify").then((m) => {
        void m.notifyTaskSuccess(runtime.agentName);
      });
    }

    return committed;
  } catch (error) {
    const msg = formatUserError(error);
    emitAgentEvent(ctx, runtime.agentName, "error", startMs, msg);

    // ★ 系统通知：任务失败
    if (!isVideoAgent) {
      import("@/lib/systemNotify").then((m) => {
        void m.notifyTaskFailure(runtime.agentName, msg);
      });
    }

    ctx.setStatusText(`${runtime.agentName} 执行失败：${msg}`);
    throw error;
  }
}

