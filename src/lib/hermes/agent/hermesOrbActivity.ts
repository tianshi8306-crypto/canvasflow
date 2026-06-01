import type { HermesJob } from "@/lib/hermes/agent/hermesJobStore";
import {
  buildJobCenterRows,
  jobStatusLabel,
  listBackgroundHermesTasks,
  type HermesJobCenterRow,
} from "@/lib/hermes/agent/hermesJobCenterModel";
import type { HermesJobAmbientSnapshot } from "@/lib/hermes/agent/hermesJobAmbient";
import type { HermesTask } from "@/lib/hermes/hermesTaskTrack";

export type HermesOrbActivity = "idle" | "planning" | "running" | "failed";

const ROW_PRIORITY: Record<HermesJobCenterRow["job"]["status"], number> = {
  running: 0,
  failed: 1,
  queued: 2,
  done: 9,
  cancelled: 9,
};

const TASK_PRIORITY: Record<HermesTask["status"], number> = {
  running: 0,
  failed: 1,
  queued: 2,
  done: 9,
};

function taskStatusLabel(status: HermesTask["status"]): string {
  switch (status) {
    case "queued":
      return "排队";
    case "running":
      return "进行中";
    case "failed":
      return "失败";
    default:
      return status;
  }
}

/** Orb 四态：失败 > 规划 > 执行中 > 待命 */
export function resolveHermesOrbActivity(opts: {
  planning: boolean;
  streaming: boolean;
  snapshot: HermesJobAmbientSnapshot;
  backgroundFailed?: number;
}): HermesOrbActivity {
  const failedTotal = opts.snapshot.failed + (opts.backgroundFailed ?? 0);
  if (failedTotal > 0) return "failed";
  if (opts.planning) return "planning";
  if (opts.snapshot.running > 0 || opts.snapshot.queued > 0) return "running";
  if (opts.streaming) return "planning";
  return "idle";
}

/** Hover / 摘要：最多 N 条最近活跃任务（非完整待办树） */
export function pickHermesOrbRecentTaskLines(
  jobs: HermesJob[],
  tasks: HermesTask[],
  projectPath: string | null,
  limit = 2,
): string[] {
  const rows = buildJobCenterRows(jobs, projectPath).filter((r) =>
    ["running", "queued", "failed"].includes(r.job.status),
  );
  const background = listBackgroundHermesTasks(tasks);

  const sortedRows = [...rows].sort((a, b) => {
    const d = ROW_PRIORITY[a.job.status] - ROW_PRIORITY[b.job.status];
    if (d !== 0) return d;
    return b.job.createdAt - a.job.createdAt;
  });

  const sortedBg = [...background].sort(
    (a, b) => TASK_PRIORITY[a.status] - TASK_PRIORITY[b.status],
  );

  const lines: string[] = [];
  for (const row of sortedRows) {
    lines.push(`${row.job.title} · ${jobStatusLabel(row.job.status)}`);
    if (lines.length >= limit) return lines;
  }
  for (const task of sortedBg) {
    lines.push(`${task.label} · ${taskStatusLabel(task.status)}`);
    if (lines.length >= limit) return lines;
  }
  return lines;
}

export function orbActivityLabel(activity: HermesOrbActivity): string {
  switch (activity) {
    case "planning":
      return "规划步骤";
    case "running":
      return "制片进行中";
    case "failed":
      return "有任务失败";
    default:
      return "待命";
  }
}
