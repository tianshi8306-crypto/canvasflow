import type {
  HermesDirectorPlan,
  HermesPlanExecutionState,
  HermesPlanStep,
  HermesToolId,
} from "@/lib/hermes/hermesDirectorTypes";
import {
  appendHermesMemoryFact,
  loadHermesPersistentMemory,
  type HermesPersistentMemory,
} from "@/lib/hermes/agent/hermesPersistentMemory";
import { completedStepsFromState } from "@/lib/hermes/agent/hermesJobReflection";

const RECOVERY_TOOLS = new Set<HermesToolId>([
  "image.retry_failed",
  "video.retry_failed",
  "film.workflow_check",
  "script.generate_storyboard",
  "image.generate_for_beats",
  "video.generate_for_beats",
]);

export function isRecoveryOrientedPlan(plan: HermesDirectorPlan): boolean {
  if (plan.proactiveRecovery || plan.isRecovery) return true;
  return plan.steps.some((s) => RECOVERY_TOOLS.has(s.toolId));
}

export function recoveryMemoryKey(plan: HermesDirectorPlan): string {
  return plan.orbSuggestionId?.trim() || "recovery";
}

export function formatRecoverySuccessFact(
  plan: HermesDirectorPlan,
  completed: HermesPlanStep[],
): string {
  const key = recoveryMemoryKey(plan);
  const tools = completed.map((s) => s.toolId).join(">");
  const trigger = plan.sourceMessage.trim().slice(0, 100) || plan.title.trim();
  const via = plan.proactiveRecovery ? "灵体主动恢复" : "自动修复";
  return `[recover:${key}] 本工程${via}已成功：${trigger}（${tools}）`;
}

export function hasRecoveryMemory(
  memory: HermesPersistentMemory,
  memoryKey: string,
): boolean {
  const prefix = `[recover:${memoryKey}]`;
  return memory.facts.some((f) => f.text.startsWith(prefix));
}

export async function writeRecoverySuccessMemory(
  projectPath: string,
  plan: HermesDirectorPlan,
  state: HermesPlanExecutionState,
): Promise<{ wrote: boolean; fact?: string }> {
  if (state.error) return { wrote: false };
  const completed = completedStepsFromState(plan, state);
  if (completed.length === 0) return { wrote: false };
  if (!isRecoveryOrientedPlan(plan)) return { wrote: false };

  const memKey = recoveryMemoryKey(plan);
  const memory = await loadHermesPersistentMemory(projectPath);
  if (hasRecoveryMemory(memory, memKey)) {
    const sameTools = memory.facts.some((f) =>
      f.text.includes(completed.map((s) => s.toolId).join(">")),
    );
    if (sameTools) return { wrote: false };
  }

  const fact = formatRecoverySuccessFact(plan, completed);
  await appendHermesMemoryFact(projectPath, fact, "agent");
  return { wrote: true, fact };
}
