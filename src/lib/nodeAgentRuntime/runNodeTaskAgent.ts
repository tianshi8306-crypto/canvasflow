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
  // 统一分发到全局事件流，便于状态栏/日志面板在不耦合 store 的情况下订阅。
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new CustomEvent<NodeAgentRuntimeEvent>("node-agent-event", { detail: evt }));
  }
}

/**
 * 统一单任务 Agent 调度入口：
 * 感知输入 -> 执行 -> 结果校验 -> 回写节点记忆体。
 */
export async function runNodeTaskAgent<TInput, TSensed, TExecuted, TCommitted>(
  runtime: NodeTaskAgentRuntime<TInput, TSensed, TExecuted, TCommitted>,
  input: TInput,
  ctx: NodeAgentContext,
): Promise<TCommitted> {
  const startMs = Date.now();
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
    return committed;
  } catch (error) {
    const msg = formatUserError(error);
    emitAgentEvent(ctx, runtime.agentName, "error", startMs, msg);
    ctx.setStatusText(`${runtime.agentName} 执行失败：${msg}`);
    throw error;
  }
}

