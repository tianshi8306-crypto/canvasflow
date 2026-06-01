import type { HermesDirectorPlan } from "@/lib/hermes/hermesDirectorTypes";

const STORAGE_KEY = "canvasflow.hermesPendingBatch.v1";

type Stored = {
  projectPath: string;
  plan: HermesDirectorPlan;
  beatCount: number;
  savedAt: number;
};

function storageKey(projectPath: string): string {
  return `${STORAGE_KEY}:${projectPath}`;
}

export function loadPendingBatchPlan(
  projectPath: string | null,
): { plan: HermesDirectorPlan; beatCount: number } | null {
  if (!projectPath?.trim() || typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(projectPath));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (parsed.projectPath !== projectPath) return null;
    if (!parsed.plan?.steps?.length) return null;
    return { plan: parsed.plan, beatCount: parsed.beatCount };
  } catch {
    return null;
  }
}

export function savePendingBatchPlan(
  projectPath: string,
  plan: HermesDirectorPlan,
  beatCount: number,
): void {
  if (typeof sessionStorage === "undefined") return;
  const payload: Stored = {
    projectPath,
    plan,
    beatCount,
    savedAt: Date.now(),
  };
  try {
    sessionStorage.setItem(storageKey(projectPath), JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

export function clearPendingBatchPlan(projectPath: string | null): void {
  if (!projectPath?.trim() || typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(storageKey(projectPath));
  } catch {
    /* ignore */
  }
}
