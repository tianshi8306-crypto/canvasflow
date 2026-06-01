import type { HermesDirectorPlan } from "@/lib/hermes/hermesDirectorTypes";

const STORAGE_PREFIX = "canvasflow.hermesPendingExecute.v1";

type Stored = {
  projectPath: string;
  plan: HermesDirectorPlan;
  savedAt: number;
};

function storageKey(projectPath: string): string {
  return `${STORAGE_PREFIX}:${projectPath.trim()}`;
}

export function loadPendingExecutePlan(
  projectPath: string | null,
): HermesDirectorPlan | null {
  if (!projectPath?.trim() || typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(projectPath));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (parsed.projectPath !== projectPath) return null;
    if (!parsed.plan?.steps?.length) return null;
    return parsed.plan;
  } catch {
    return null;
  }
}

export function savePendingExecutePlan(
  projectPath: string,
  plan: HermesDirectorPlan,
): void {
  if (typeof sessionStorage === "undefined") return;
  const payload: Stored = {
    projectPath,
    plan,
    savedAt: Date.now(),
  };
  try {
    sessionStorage.setItem(storageKey(projectPath), JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

export function clearPendingExecutePlan(projectPath: string | null): void {
  if (!projectPath?.trim() || typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(storageKey(projectPath));
  } catch {
    /* ignore */
  }
}
