import type { HermesDirectorPlan } from "@/lib/hermes/hermesDirectorTypes";

const STORAGE_KEY = "canvasflow.hermesLastPlan.v1";

type Stored = {
  projectPath: string;
  plan: HermesDirectorPlan;
  savedAt: number;
};

function storageKey(projectPath: string): string {
  return `${STORAGE_KEY}:${projectPath}`;
}

export function saveLastHermesPlan(projectPath: string, plan: HermesDirectorPlan): void {
  if (typeof sessionStorage === "undefined") return;
  const payload: Stored = { projectPath, plan, savedAt: Date.now() };
  try {
    sessionStorage.setItem(storageKey(projectPath), JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

export function loadLastHermesPlan(projectPath: string | null): HermesDirectorPlan | null {
  if (!projectPath?.trim() || typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(projectPath));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (parsed.projectPath !== projectPath) return null;
    return parsed.plan?.steps?.length ? parsed.plan : null;
  } catch {
    return null;
  }
}
