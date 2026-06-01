import type { HermesJob } from "@/lib/hermes/agent/hermesJobStore";
import {
  buildJobCenterRows,
  listBackgroundHermesTasks,
  summarizeJobCenter,
} from "@/lib/hermes/agent/hermesJobCenterModel";
import type { HermesTask } from "@/lib/hermes/hermesTaskTrack";

export type HermesJobAmbientSnapshot = {
  visible: boolean;
  summary: string;
  running: number;
  queued: number;
  failed: number;
  /** 有进行中/排队/失败任务（不含仅「最近完成」） */
  hasActive: boolean;
};

export function buildHermesJobAmbientSnapshot(
  jobs: HermesJob[],
  tasks: HermesTask[],
  projectPath: string | null,
): HermesJobAmbientSnapshot {
  const rows = buildJobCenterRows(jobs, projectPath);
  const backgroundTasks = listBackgroundHermesTasks(tasks);
  if (rows.length === 0 && backgroundTasks.length === 0) {
    return {
      visible: false,
      summary: "",
      running: 0,
      queued: 0,
      failed: 0,
      hasActive: false,
    };
  }

  const runningJobs = rows.filter((r) => r.job.status === "running").length;
  const queuedJobs = rows.filter((r) => r.job.status === "queued").length;
  const failedJobs = rows.filter((r) => r.job.status === "failed").length;
  const runningBg = backgroundTasks.filter((t) => t.status === "running").length;
  const queuedBg = backgroundTasks.filter((t) => t.status === "queued").length;
  const failedBg = backgroundTasks.filter((t) => t.status === "failed").length;

  const running = runningJobs + runningBg;
  const queued = queuedJobs + queuedBg;
  const failed = failedJobs + failedBg;
  const summary = summarizeJobCenter(rows, backgroundTasks);

  return {
    visible: true,
    summary: summary || "进行中",
    running,
    queued,
    failed,
    hasActive: running > 0 || queued > 0 || failed > 0,
  };
}

export function formatHermesOrbJobTitle(
  snapshot: HermesJobAmbientSnapshot,
  agentShortName: string,
): string | null {
  if (!snapshot.hasActive) return null;
  const parts: string[] = [];
  if (snapshot.running > 0) parts.push(`${snapshot.running} 进行中`);
  if (snapshot.queued > 0) parts.push(`${snapshot.queued} 排队`);
  if (snapshot.failed > 0) parts.push(`${snapshot.failed} 失败`);
  return `${agentShortName} · ${parts.join(" · ")} · 点击查看任务`;
}
