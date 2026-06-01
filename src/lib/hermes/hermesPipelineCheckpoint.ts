import type { HermesDirectorPlan } from "@/lib/hermes/hermesDirectorTypes";

const STORAGE_PREFIX = "canvasflow.hermesPipelineCheckpoint.v1";

export type HermesPipelineCheckpoint = {
  projectPath: string;
  plan: HermesDirectorPlan;
  /** 已成功完成的步骤数（对 plan.steps 下标切片） */
  completedStepCount: number;
  savedAt: number;
};

function storageKey(projectPath: string): string {
  return `${STORAGE_PREFIX}:${projectPath.trim()}`;
}

export function loadPipelineCheckpoint(
  projectPath: string | null,
): HermesPipelineCheckpoint | null {
  if (!projectPath?.trim() || typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(projectPath));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HermesPipelineCheckpoint;
    if (parsed.projectPath !== projectPath) return null;
    if (!parsed.plan?.steps?.length) return null;
    if (parsed.completedStepCount < 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePipelineCheckpoint(
  projectPath: string,
  checkpoint: Omit<HermesPipelineCheckpoint, "projectPath" | "savedAt">,
): void {
  if (typeof localStorage === "undefined") return;
  const payload: HermesPipelineCheckpoint = {
    projectPath,
    plan: checkpoint.plan,
    completedStepCount: checkpoint.completedStepCount,
    savedAt: Date.now(),
  };
  try {
    localStorage.setItem(storageKey(projectPath), JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

export function clearPipelineCheckpoint(projectPath: string | null): void {
  if (!projectPath?.trim() || typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(storageKey(projectPath));
  } catch {
    /* ignore */
  }
}

/** 从断点生成待执行子计划（新 plan id，步骤为剩余部分） */
export function planFromPipelineCheckpoint(cp: HermesPipelineCheckpoint): HermesDirectorPlan | null {
  const remaining = cp.plan.steps.slice(cp.completedStepCount);
  if (remaining.length === 0) return null;
  const done = cp.completedStepCount;
  const total = cp.plan.steps.length;
  return {
    ...cp.plan,
    id: crypto.randomUUID(),
    title: `${cp.plan.title}（续跑 ${done + 1}/${total}）`,
    steps: remaining.map((s) => ({ ...s, id: crypto.randomUUID() })),
    isRecovery: false,
  };
}

export function formatCheckpointStatus(cp: HermesPipelineCheckpoint): string {
  const total = cp.plan.steps.length;
  const done = Math.min(cp.completedStepCount, total);
  const tpl = cp.plan.templateId ? `模板 ${cp.plan.templateId}` : cp.plan.title;
  return `工程内有未跑完的制片计划（${tpl}）：已完成 ${done}/${total} 步。可说「继续跑片」从下一步接着执行。`;
}
