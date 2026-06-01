import type { HermesJob } from "@/lib/hermes/agent/hermesJobStore";
import {
  countQueuedDirectorJobs,
  countRunningDirectorJobs,
} from "@/lib/hermes/agent/hermesJobStore";

export type DirectorJobQueueSnapshot = {
  running: HermesJob | null;
  queued: HermesJob[];
  runningCount: number;
  queuedCount: number;
};

export type EnqueueDirectorPlanPriority = "normal" | "high";

export function queuePriorityValue(
  priority: EnqueueDirectorPlanPriority | number | undefined,
): number {
  if (typeof priority === "number" && Number.isFinite(priority)) {
    return Math.round(priority);
  }
  return priority === "high" ? 10 : 0;
}

/** 排队任务排序：优先级高者先，同优先级 FIFO */
export function compareQueuedDirectorJobs(a: HermesJob, b: HermesJob): number {
  const pa = a.queuePriority ?? 0;
  const pb = b.queuePriority ?? 0;
  if (pa !== pb) return pb - pa;
  if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
  const sa = a.queueSequence ?? 0;
  const sb = b.queueSequence ?? 0;
  if (sa !== sb) return sa - sb;
  return a.id.localeCompare(b.id);
}

export function listQueuedDirectorJobs(
  jobs: HermesJob[],
  projectPath: string,
): HermesJob[] {
  return jobs
    .filter(
      (j) =>
        j.projectPath === projectPath &&
        j.kind === "director_plan" &&
        j.status === "queued",
    )
    .sort(compareQueuedDirectorJobs);
}

export function pickNextQueuedDirectorJob(
  jobs: HermesJob[],
  projectPath: string,
): HermesJob | undefined {
  return listQueuedDirectorJobs(jobs, projectPath)[0];
}

export function buildDirectorJobQueueSnapshot(
  jobs: HermesJob[],
  projectPath: string | null,
): DirectorJobQueueSnapshot | null {
  if (!projectPath?.trim()) return null;
  const path = projectPath.trim();
  const projectJobs = jobs.filter(
    (j) => j.projectPath === path && j.kind === "director_plan",
  );
  const running =
    projectJobs.find((j) => j.status === "running") ?? null;
  const queued = listQueuedDirectorJobs(projectJobs, path);
  return {
    running,
    queued,
    runningCount: countRunningDirectorJobs(jobs, path),
    queuedCount: countQueuedDirectorJobs(jobs, path),
  };
}

export function queuePositionForJob(
  job: HermesJob,
  queued: HermesJob[],
): number | null {
  if (job.status !== "queued") return null;
  const idx = queued.findIndex((q) => q.id === job.id);
  return idx === -1 ? null : idx + 1;
}

export function formatDirectorJobQueueForChat(
  snapshot: DirectorJobQueueSnapshot,
): string {
  const lines: string[] = [];
  if (snapshot.running) {
    lines.push(
      `▶ 执行中：${snapshot.running.title}（${snapshot.running.progress?.done ?? 0}/${snapshot.running.progress?.total ?? "?"} 步）`,
    );
  }
  if (snapshot.queued.length === 0) {
    lines.push(snapshot.running ? "排队：无" : "当前无排队制片任务。");
  } else {
    lines.push(`排队 ${snapshot.queued.length} 个（高优先级先执行）：`);
    snapshot.queued.forEach((j, i) => {
      const pri =
        (j.queuePriority ?? 0) > 0 ? ` · 优先 ${j.queuePriority}` : "";
      lines.push(`  ${i + 1}. ${j.title}${pri}`);
    });
  }
  lines.push(
    "",
    "可说「取消全部排队」清空队列；「取消第 2 镜出图」按镜号取消；新任务默认排在队尾，紧急可说「优先执行」。",
  );
  return lines.join("\n");
}

export function nextQueuePriorityForFront(
  jobs: HermesJob[],
  projectPath: string,
): number {
  const queued = listQueuedDirectorJobs(jobs, projectPath);
  const maxPri = queued.reduce((m, j) => Math.max(m, j.queuePriority ?? 0), 0);
  return maxPri + 1;
}

/** 按给定 id 顺序重写排队优先级（仅 queued） */
export function prioritiesFromOrderedJobIds(
  orderedIds: string[],
): Map<string, number> {
  const map = new Map<string, number>();
  const n = orderedIds.length;
  orderedIds.forEach((id, i) => {
    map.set(id, (n - i) * 10);
  });
  return map;
}
