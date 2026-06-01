import { create } from "zustand";
import type {
  HermesDirectorPlan,
  HermesStepRunStatus,
} from "@/lib/hermes/hermesDirectorTypes";

export type { HermesStepRunStatus };
import type { ExecuteDirectorPlanResult } from "@/lib/hermes/hermesDirector";
import {
  loadHermesJobsFromSession,
  saveHermesJobsToSession,
} from "@/lib/hermes/agent/hermesJobPersistence";
import {
  nextQueuePriorityForFront,
  pickNextQueuedDirectorJob,
  queuePriorityValue,
  type EnqueueDirectorPlanPriority,
} from "@/lib/hermes/agent/hermesJobOrchestration";

export type HermesJobKind = "director_plan";

export type HermesJobStatus =
  | "queued"
  | "running"
  | "done"
  | "failed"
  | "cancelled";

export type HermesDirectorPlanJobPayload = {
  plan: HermesDirectorPlan;
  checkpointBasePlan?: HermesDirectorPlan;
  allowRecovery?: boolean;
};

export type HermesJob = {
  id: string;
  projectPath: string;
  kind: HermesJobKind;
  status: HermesJobStatus;
  title: string;
  progress?: { done: number; total: number };
  /** M1：计划内各步骤状态（执行中更新） */
  stepStatuses?: Record<string, HermesStepRunStatus>;
  currentStepId?: string | null;
  error?: string;
  createdAt: number;
  finishedAt?: number;
  /** 排队优先级（越大越先执行） */
  queuePriority?: number;
  /** 同优先级、同毫秒内入队时的 FIFO 序号 */
  queueSequence?: number;
  payload: HermesDirectorPlanJobPayload;
};

export type EnqueueDirectorPlanOptions = {
  priority?: EnqueueDirectorPlanPriority | number;
  /** 插入队首（提升优先级到当前队列最高 +1） */
  enqueueAtFront?: boolean;
};

export type DirectorPlanJobExecutor = (
  payload: HermesDirectorPlanJobPayload,
  jobId: string,
) => Promise<ExecuteDirectorPlanResult>;

type HermesJobState = {
  jobs: HermesJob[];
  enqueueDirectorPlan: (
    projectPath: string,
    payload: HermesDirectorPlanJobPayload,
    title?: string,
    options?: EnqueueDirectorPlanOptions,
  ) => string;
  cancelJob: (jobId: string) => void;
  cancelAllQueuedDirectorPlans: (projectPath: string) => number;
  bumpDirectorJobToFront: (jobId: string) => boolean;
  resetProjectJobs: (projectPath: string) => void;
  resetAll: () => void;
};

const processors = new Map<string, boolean>();
const cancelRequested = new Set<string>();
let executor: DirectorPlanJobExecutor | null = null;
let directorJobEnqueueSequence = 0;

/** 执行器检测到取消后写入 plan state.error，drainQueue 据此标记 Job */
export const HERMES_JOB_CANCELLED_ERROR = "用户已取消制片任务";

export function isDirectorJobCancelRequested(jobId: string): boolean {
  return cancelRequested.has(jobId);
}

export function requestDirectorJobCancel(jobId: string): void {
  cancelRequested.add(jobId);
}

export function clearDirectorJobCancelRequest(jobId: string): void {
  cancelRequested.delete(jobId);
}

export function registerDirectorPlanJobExecutor(fn: DirectorPlanJobExecutor): void {
  executor = fn;
}

export function titleForDirectorPlan(plan: HermesDirectorPlan): string {
  const fromTitle = plan.title?.trim();
  if (fromTitle) return fromTitle;
  const fromMsg = plan.sourceMessage?.trim();
  if (fromMsg) {
    return fromMsg.length > 36 ? `${fromMsg.slice(0, 36)}…` : fromMsg;
  }
  const first = plan.steps[0]?.label?.trim();
  return first || "制片计划";
}

function jobId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function countRunningDirectorJobs(
  jobs: HermesJob[],
  projectPath?: string | null,
): number {
  return jobs.filter(
    (j) =>
      j.kind === "director_plan" &&
      j.status === "running" &&
      (!projectPath || j.projectPath === projectPath),
  ).length;
}

export function countQueuedDirectorJobs(
  jobs: HermesJob[],
  projectPath?: string | null,
): number {
  return jobs.filter(
    (j) =>
      j.kind === "director_plan" &&
      j.status === "queued" &&
      (!projectPath || j.projectPath === projectPath),
  ).length;
}

export function hasActiveDirectorJobs(
  jobs: HermesJob[],
  projectPath?: string | null,
): boolean {
  return jobs.some(
    (j) =>
      j.kind === "director_plan" &&
      (j.status === "running" || j.status === "queued") &&
      (!projectPath || j.projectPath === projectPath),
  );
}

function schedulePersistJobs(projectPath: string): void {
  if (!projectPath?.trim()) return;
  queueMicrotask(() => {
    const jobs = useHermesJobStore.getState().jobs;
    saveHermesJobsToSession(projectPath, jobs);
  });
}

export function hydrateHermesJobsForProject(projectPath: string | null): void {
  if (!projectPath?.trim()) return;
  const stored = loadHermesJobsFromSession(projectPath);
  if (stored.length === 0) return;

  useHermesJobStore.setState((s) => {
    const activeIds = new Set(
      s.jobs
        .filter(
          (j) =>
            j.projectPath === projectPath &&
            (j.status === "running" || j.status === "queued"),
        )
        .map((j) => j.id),
    );
    const historic = stored.filter(
      (h) =>
        !activeIds.has(h.id) &&
        h.status !== "running" &&
        h.status !== "queued",
    );
    const others = s.jobs.filter((j) => j.projectPath !== projectPath);
    const currentProject = s.jobs.filter(
      (j) => j.projectPath === projectPath && activeIds.has(j.id),
    );
    const byId = new Map<string, HermesJob>();
    for (const j of [...historic, ...currentProject]) {
      byId.set(j.id, j);
    }
    return { jobs: [...others, ...byId.values()] };
  });
}

function patchJob(
  jobs: HermesJob[],
  id: string,
  patch: Partial<HermesJob>,
): HermesJob[] {
  const idx = jobs.findIndex((j) => j.id === id);
  if (idx === -1) return jobs;
  const copy = [...jobs];
  copy[idx] = { ...copy[idx]!, ...patch };
  return copy;
}

export function countDoneSteps(
  stepStatuses: Record<string, HermesStepRunStatus> | undefined,
): number {
  if (!stepStatuses) return 0;
  return Object.values(stepStatuses).filter((s) => s === "done").length;
}

export function initDirectorJobExecution(
  jobId: string,
  plan: HermesDirectorPlan,
): void {
  const stepStatuses = Object.fromEntries(
    plan.steps.map((s) => [s.id, "pending" as HermesStepRunStatus]),
  );
  useHermesJobStore.setState((s) => ({
    jobs: patchJob(s.jobs, jobId, {
      stepStatuses,
      currentStepId: null,
      progress: { done: 0, total: plan.steps.length },
    }),
  }));
}

export function patchDirectorJobExecution(
  jobId: string,
  patch: {
    stepStatuses?: Record<string, HermesStepRunStatus>;
    currentStepId?: string | null;
    progress?: { done: number; total: number };
  },
): void {
  useHermesJobStore.setState((s) => ({
    jobs: patchJob(s.jobs, jobId, patch),
  }));
}

export function patchDirectorJobStep(
  jobId: string,
  stepId: string,
  status: HermesStepRunStatus,
  allStepIds: string[],
): void {
  useHermesJobStore.setState((s) => {
    const job = s.jobs.find((j) => j.id === jobId);
    if (!job) return s;
    const stepStatuses = { ...(job.stepStatuses ?? {}), [stepId]: status };
    const done = countDoneSteps(stepStatuses);
    return {
      jobs: patchJob(s.jobs, jobId, {
        stepStatuses,
        currentStepId: status === "running" ? stepId : job.currentStepId,
        progress: { done, total: allStepIds.length || job.progress?.total || 0 },
      }),
    };
  });
}

export function syncDirectorJobStepList(
  jobId: string,
  steps: Array<{ id: string }>,
): void {
  useHermesJobStore.setState((s) => {
    const job = s.jobs.find((j) => j.id === jobId);
    if (!job) return s;
    const prev = job.stepStatuses ?? {};
    const stepStatuses = Object.fromEntries(
      steps.map((s) => [s.id, prev[s.id] ?? ("pending" as HermesStepRunStatus)]),
    );
    const done = countDoneSteps(stepStatuses);
    return {
      jobs: patchJob(s.jobs, jobId, {
        stepStatuses,
        progress: { done, total: steps.length },
      }),
    };
  });
}

async function drainQueue(projectPath: string): Promise<void> {
  if (processors.get(projectPath)) return;
  processors.set(projectPath, true);
  try {
    while (true) {
      const state = useHermesJobStore.getState();
      const next = pickNextQueuedDirectorJob(state.jobs, projectPath);
      if (!next) break;

      const live = useHermesJobStore.getState().jobs.find((j) => j.id === next.id);
      if (!live || live.status !== "queued") continue;

      useHermesJobStore.setState((s) => ({
        jobs: patchJob(s.jobs, next.id, { status: "running" }),
      }));
      initDirectorJobExecution(next.id, next.payload.plan);

      if (!executor) {
        useHermesJobStore.setState((s) => ({
          jobs: patchJob(s.jobs, next.id, {
            status: "failed",
            error: "Job 执行器未注册",
            finishedAt: Date.now(),
          }),
        }));
        continue;
      }

      try {
        const result = await executor(next.payload, next.id);
        const wasCancelled = isDirectorJobCancelRequested(next.id);
        clearDirectorJobCancelRequest(next.id);
        if (wasCancelled || result.state.error === HERMES_JOB_CANCELLED_ERROR) {
          useHermesJobStore.setState((s) => ({
            jobs: patchJob(s.jobs, next.id, {
              status: "cancelled",
              error: HERMES_JOB_CANCELLED_ERROR,
              finishedAt: Date.now(),
            }),
          }));
          schedulePersistJobs(projectPath);
          continue;
        }
        const ok = !result.state.error;
        useHermesJobStore.setState((s) => ({
          jobs: patchJob(s.jobs, next.id, {
            status: ok ? "done" : "failed",
            error: ok ? undefined : result.state.error ?? "执行失败",
            finishedAt: Date.now(),
            progress: {
              done: next.payload.plan.steps.length,
              total: next.payload.plan.steps.length,
            },
          }),
        }));
        schedulePersistJobs(projectPath);
      } catch (err: unknown) {
        clearDirectorJobCancelRequest(next.id);
        const msg = err instanceof Error ? err.message : String(err);
        useHermesJobStore.setState((s) => ({
          jobs: patchJob(s.jobs, next.id, {
            status: "failed",
            error: msg,
            finishedAt: Date.now(),
          }),
        }));
        schedulePersistJobs(projectPath);
      }
    }
  } finally {
    processors.set(projectPath, false);
  }
}

export const useHermesJobStore = create<HermesJobState>((set) => ({
  jobs: [],

  enqueueDirectorPlan: (projectPath, payload, title, options) => {
    const id = jobId();
    const state = useHermesJobStore.getState();
    let queuePriority = queuePriorityValue(options?.priority);
    if (options?.enqueueAtFront) {
      queuePriority = Math.max(
        queuePriority,
        nextQueuePriorityForFront(state.jobs, projectPath),
      );
    }
    directorJobEnqueueSequence += 1;
    const entry: HermesJob = {
      id,
      projectPath,
      kind: "director_plan",
      status: "queued",
      title: title?.trim() || titleForDirectorPlan(payload.plan),
      progress: { done: 0, total: payload.plan.steps.length },
      createdAt: Date.now(),
      queuePriority,
      queueSequence: directorJobEnqueueSequence,
      payload,
    };
    set((s) => ({ jobs: [entry, ...s.jobs] }));
    schedulePersistJobs(projectPath);
    queueMicrotask(() => {
      void drainQueue(projectPath);
    });
    return id;
  },

  cancelJob: (jobId) => {
    let projectPath: string | undefined;
    set((s) => {
      const job = s.jobs.find((j) => j.id === jobId);
      if (!job) return s;
      projectPath = job.projectPath;
      if (job.status === "queued") {
        return {
          jobs: patchJob(s.jobs, jobId, {
            status: "cancelled",
            error: HERMES_JOB_CANCELLED_ERROR,
            finishedAt: Date.now(),
          }),
        };
      }
      if (job.status === "running") {
        requestDirectorJobCancel(jobId);
        return s;
      }
      return s;
    });
    if (projectPath) schedulePersistJobs(projectPath);
  },

  cancelAllQueuedDirectorPlans: (projectPath) => {
    let count = 0;
    set((s) => {
      const next = s.jobs.map((j) => {
        if (
          j.projectPath !== projectPath ||
          j.kind !== "director_plan" ||
          j.status !== "queued"
        ) {
          return j;
        }
        count += 1;
        return {
          ...j,
          status: "cancelled" as const,
          error: HERMES_JOB_CANCELLED_ERROR,
          finishedAt: Date.now(),
        };
      });
      return { jobs: next };
    });
    if (count > 0) schedulePersistJobs(projectPath);
    return count;
  },

  bumpDirectorJobToFront: (jobId) => {
    let ok = false;
    set((s) => {
      const job = s.jobs.find((j) => j.id === jobId);
      if (!job || job.status !== "queued" || job.kind !== "director_plan") {
        return s;
      }
      ok = true;
      const pri = nextQueuePriorityForFront(s.jobs, job.projectPath);
      return {
        jobs: patchJob(s.jobs, jobId, { queuePriority: pri }),
      };
    });
    if (ok) {
      const job = useHermesJobStore.getState().jobs.find((j) => j.id === jobId);
      if (job) {
        schedulePersistJobs(job.projectPath);
        queueMicrotask(() => {
          void drainQueue(job.projectPath);
        });
      }
    }
    return ok;
  },

  resetProjectJobs: (projectPath) => {
    set((s) => ({
      jobs: s.jobs.filter((j) => j.projectPath !== projectPath),
    }));
  },

  resetAll: () => set({ jobs: [] }),
}));

/** 单测：重置队列与执行器 */
export function resetHermesJobStoreForTest(): void {
  processors.clear();
  cancelRequested.clear();
  executor = null;
  directorJobEnqueueSequence = 0;
  useHermesJobStore.getState().resetAll();
}

export function getQueuedDirectorJobCount(projectPath?: string | null): number {
  return countQueuedDirectorJobs(useHermesJobStore.getState().jobs, projectPath);
}
