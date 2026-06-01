import type { HermesPlanStep, HermesToolId } from "@/lib/hermes/hermesDirectorTypes";
import { runHermesTool } from "@/lib/hermes/hermesTools/runHermesTool";
import { runPool } from "@/lib/async/runPool";
import { getAgentMaxConcurrentMedia } from "@/lib/hermes/agent/hermesAgentSettings";

export type HermesSubagentTask = {
  id: string;
  label: string;
  toolId: HermesToolId;
  args?: Record<string, unknown>;
};

export type HermesSubagentResult = {
  taskId: string;
  label: string;
  ok: boolean;
  message: string;
};

export const HERMES_MAX_PARALLEL_SUBAGENTS = 3;

export async function runHermesSubagents(
  tasks: HermesSubagentTask[],
  opts: {
    sourceMessage: string;
    scriptNodeId?: string | null;
    referenceRelPaths?: string[];
    maxConcurrent?: number;
  },
): Promise<HermesSubagentResult[]> {
  const capped = tasks.slice(0, HERMES_MAX_PARALLEL_SUBAGENTS * 4);
  const max = Math.min(
    opts.maxConcurrent ?? getAgentMaxConcurrentMedia(),
    HERMES_MAX_PARALLEL_SUBAGENTS,
  );

  return runPool(capped, max, async (task) => {
    const step: HermesPlanStep = {
      id: task.id,
      toolId: task.toolId,
      label: task.label,
      args: task.args,
    };
    try {
      const result = await runHermesTool(step, {
        sourceMessage: opts.sourceMessage,
        scriptNodeId: opts.scriptNodeId,
        referenceRelPaths: opts.referenceRelPaths,
        directorStepId: task.id,
      });
      return {
        taskId: task.id,
        label: task.label,
        ok: result.ok,
        message: result.message,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { taskId: task.id, label: task.label, ok: false, message: msg };
    }
  });
}

export function formatSubagentResults(results: HermesSubagentResult[]): string {
  const lines = results.map(
    (r) => `${r.ok ? "✓" : "✗"} [子Agent] ${r.label}：${r.message}`,
  );
  const ok = results.filter((r) => r.ok).length;
  return `${lines.join("\n")}\n\n并行完成 ${ok}/${results.length} 路。`;
}

/** 将镜号范围拆成并行出图子任务 */
export function buildParallelImageSubagentTasks(
  beatIdGroups: number[][],
): HermesSubagentTask[] {
  return beatIdGroups.map((beatIds, i) => ({
    id: `sub-img-${i}-${crypto.randomUUID().slice(0, 8)}`,
    label: `并行出图 镜 ${beatIds.join(",")}`,
    toolId: "image.generate_for_beats",
    args: { beatIds },
  }));
}

export function splitBeatIdsForParallel(
  beatIds: number[],
  chunkCount: number,
): number[][] {
  if (beatIds.length === 0) return [];
  const n = Math.min(Math.max(1, chunkCount), HERMES_MAX_PARALLEL_SUBAGENTS);
  const chunks: number[][] = Array.from({ length: n }, () => []);
  beatIds.forEach((id, i) => {
    chunks[i % n]!.push(id);
  });
  return chunks.filter((c) => c.length > 0);
}
