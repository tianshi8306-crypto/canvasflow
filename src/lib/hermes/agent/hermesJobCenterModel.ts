import type { HermesJob, HermesJobStatus } from "@/lib/hermes/agent/hermesJobStore";
import { countDoneSteps } from "@/lib/hermes/agent/hermesJobStore";
import {
  buildDirectorJobQueueSnapshot,
  listQueuedDirectorJobs,
  queuePositionForJob,
} from "@/lib/hermes/agent/hermesJobOrchestration";
import type { HermesStepRunStatus } from "@/lib/hermes/hermesDirectorTypes";
import type { HermesTask } from "@/lib/hermes/hermesTaskTrack";

export type HermesJobStepRow = {
  id: string;
  label: string;
  status: HermesStepRunStatus;
};

export type HermesJobCenterRow = {
  job: HermesJob;
  steps: HermesJobStepRow[];
  doneCount: number;
  totalSteps: number;
  /** 排队序号（1-based），仅 queued */
  queuePosition: number | null;
};

const JOB_STATUS_ORDER: Record<HermesJobStatus, number> = {
  running: 0,
  queued: 1,
  failed: 2,
  done: 3,
  cancelled: 4,
};

export function jobStatusLabel(status: HermesJobStatus): string {
  switch (status) {
    case "queued":
      return "排队";
    case "running":
      return "进行中";
    case "done":
      return "完成";
    case "failed":
      return "失败";
    case "cancelled":
      return "已取消";
    default:
      return status;
  }
}

export function stepStatusGlyph(status: HermesStepRunStatus): string {
  switch (status) {
    case "done":
      return "✓";
    case "running":
      return "▶";
    case "failed":
      return "✗";
    case "skipped":
      return "⊘";
    default:
      return "○";
  }
}

export function buildJobCenterRows(
  jobs: HermesJob[],
  projectPath: string | null,
): HermesJobCenterRow[] {
  if (!projectPath?.trim()) return [];
  const filtered = jobs.filter(
    (j) => j.projectPath === projectPath && j.kind === "director_plan",
  );
  const queuedOrdered = listQueuedDirectorJobs(filtered, projectPath.trim());
  const sorted = [...filtered].sort((a, b) => {
    const d = JOB_STATUS_ORDER[a.status] - JOB_STATUS_ORDER[b.status];
    if (d !== 0) return d;
    if (a.status === "queued" && b.status === "queued") {
      const qa = queuedOrdered.findIndex((q) => q.id === a.id);
      const qb = queuedOrdered.findIndex((q) => q.id === b.id);
      if (qa !== -1 && qb !== -1) return qa - qb;
    }
    return b.createdAt - a.createdAt;
  });
  return sorted.map((job) => {
    const planSteps = job.payload.plan.steps;
    const statuses = job.stepStatuses ?? {};
    const steps: HermesJobStepRow[] = planSteps.map((s) => ({
      id: s.id,
      label: s.label,
      status: statuses[s.id] ?? (job.status === "queued" ? "pending" : "pending"),
    }));
    const doneCount = job.progress?.done ?? countDoneSteps(job.stepStatuses);
    const totalSteps = job.progress?.total ?? planSteps.length;
    return {
      job,
      steps,
      doneCount,
      totalSteps,
      queuePosition: queuePositionForJob(job, queuedOrdered),
    };
  });
}

export function formatJobCenterQueueHint(
  jobs: HermesJob[],
  projectPath: string | null,
): string | null {
  const snap = buildDirectorJobQueueSnapshot(jobs, projectPath);
  if (!snap || (snap.runningCount === 0 && snap.queuedCount === 0)) return null;
  const parts: string[] = [];
  if (snap.runningCount > 0) parts.push("1 个执行中");
  if (snap.queuedCount > 0) parts.push(`${snap.queuedCount} 个排队`);
  return parts.join(" · ");
}

/** 镜级/对话等后台任务（不重复展示计划级 director/planjob 行） */
export function listBackgroundHermesTasks(tasks: HermesTask[]): HermesTask[] {
  return tasks.filter(
    (t) =>
      !t.id.startsWith("planjob:") &&
      !t.id.startsWith("director:") &&
      (t.status === "running" || t.status === "queued" || t.status === "failed"),
  );
}

export function summarizeJobCenter(
  rows: HermesJobCenterRow[],
  backgroundTasks: HermesTask[],
): string {
  const running = rows.filter((r) => r.job.status === "running").length;
  const queued = rows.filter((r) => r.job.status === "queued").length;
  const failed = rows.filter((r) => r.job.status === "failed").length;
  const parts: string[] = [];
  if (running > 0) parts.push(`${running} 进行中`);
  if (queued > 0) parts.push(`${queued} 排队`);
  if (failed > 0) parts.push(`${failed} 失败`);
  if (parts.length === 0 && backgroundTasks.length > 0) {
    return `${backgroundTasks.length} 个后台任务`;
  }
  if (parts.length === 0) return rows.length > 0 ? "最近完成" : "";
  return parts.join(" · ");
}
