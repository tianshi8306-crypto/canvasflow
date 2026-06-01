import type { HermesDirectorPlan } from "@/lib/hermes/hermesDirectorTypes";
import type { HermesJob } from "@/lib/hermes/agent/hermesJobStore";

const STORAGE_KEY = "canvasflow.hermesJobs.v1";
const MAX_JOBS_PER_PROJECT = 24;

type PersistedPlanStep = {
  id: string;
  label: string;
  toolId: string;
};

type PersistedJobPayload = {
  planId: string;
  title: string;
  sourceMessage: string;
  isRecovery?: boolean;
  steps: PersistedPlanStep[];
  allowRecovery?: boolean;
};

export type PersistedHermesJob = Omit<HermesJob, "payload"> & {
  payload: PersistedJobPayload;
};

type Stored = {
  projectPath: string;
  jobs: PersistedHermesJob[];
  savedAt: number;
};

function storageKey(projectPath: string): string {
  return `${STORAGE_KEY}:${projectPath}`;
}

function toPersisted(job: HermesJob): PersistedHermesJob {
  const plan = job.payload.plan;
  return {
    ...job,
    payload: {
      planId: plan.id,
      title: plan.title,
      sourceMessage: plan.sourceMessage,
      isRecovery: plan.isRecovery,
      steps: plan.steps.map((s) => ({
        id: s.id,
        label: s.label,
        toolId: s.toolId,
      })),
      allowRecovery: job.payload.allowRecovery,
    },
  };
}

function fromPersisted(p: PersistedHermesJob): HermesJob {
  const plan: HermesDirectorPlan = {
    id: p.payload.planId,
    title: p.payload.title,
    sourceMessage: p.payload.sourceMessage,
    isRecovery: p.payload.isRecovery,
    steps: p.payload.steps.map((s) => ({
      id: s.id,
      label: s.label,
      toolId: s.toolId as HermesDirectorPlan["steps"][number]["toolId"],
    })),
  };
  return {
    ...p,
    payload: {
      plan,
      allowRecovery: p.payload.allowRecovery,
    },
  };
}

export function saveHermesJobsToSession(projectPath: string, jobs: HermesJob[]): void {
  if (!projectPath?.trim() || typeof sessionStorage === "undefined") return;
  const forProject = jobs
    .filter((j) => j.projectPath === projectPath && j.kind === "director_plan")
    .filter((j) => j.status !== "running" && j.status !== "queued")
    .map(toPersisted)
    .sort((a, b) => (b.finishedAt ?? b.createdAt) - (a.finishedAt ?? a.createdAt))
    .slice(0, MAX_JOBS_PER_PROJECT);
  const merged = forProject.slice(0, MAX_JOBS_PER_PROJECT);
  try {
    const payload: Stored = {
      projectPath,
      jobs: merged,
      savedAt: Date.now(),
    };
    sessionStorage.setItem(storageKey(projectPath), JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

export function loadHermesJobsFromSession(projectPath: string | null): HermesJob[] {
  if (!projectPath?.trim() || typeof sessionStorage === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(storageKey(projectPath));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Stored;
    if (parsed.projectPath !== projectPath || !Array.isArray(parsed.jobs)) {
      return [];
    }
    return parsed.jobs
      .filter((j) => j?.payload?.steps?.length)
      .map(fromPersisted);
  } catch {
    return [];
  }
}

