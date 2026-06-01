import { useMemo, useState } from "react";
import { useHermesJobStore } from "@/lib/hermes/agent/hermesJobStore";
import {
  buildJobCenterRows,
  jobStatusLabel,
  listBackgroundHermesTasks,
  stepStatusGlyph,
  summarizeJobCenter,
} from "@/lib/hermes/agent/hermesJobCenterModel";
import type { HermesTask } from "@/lib/hermes/hermesTaskTrack";
import { useHermesTaskStore } from "@/store/hermesTaskStore";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";

function statusLabel(status: HermesTask["status"]): string {
  switch (status) {
    case "queued":
      return "排队";
    case "running":
      return "进行中";
    case "done":
      return "完成";
    case "failed":
      return "失败";
    default:
      return status;
  }
}

type JobCardProps = {
  row: ReturnType<typeof buildJobCenterRows>[number];
  expanded: boolean;
  onToggle: () => void;
  onCancel?: () => void;
};

function JobCard({ row, expanded, onToggle, onCancel }: JobCardProps) {
  const { job, steps, doneCount, totalSteps, queuePosition } = row;
  const pct =
    totalSteps > 0 ? Math.min(100, Math.round((doneCount / totalSteps) * 100)) : 0;
  const canCancel = job.status === "queued" || job.status === "running";

  return (
    <li className={`hermesJobCard hermesJobCard--${job.status}`}>
      <div className="hermesJobCardHead">
        <button
          type="button"
          className="hermesJobCardToggle"
          aria-expanded={expanded}
          onClick={onToggle}
        >
          <span className="hermesJobCardChevron" aria-hidden>
            {expanded ? "▾" : "▸"}
          </span>
          <span className="hermesJobCardTitle" title={job.title}>
            {job.title}
          </span>
          <span className={`hermesJobCardBadge hermesJobCardBadge--${job.status}`}>
            {job.status === "queued" && queuePosition != null
              ? `排队 #${queuePosition}`
              : jobStatusLabel(job.status)}
          </span>
        </button>
        {canCancel && onCancel ? (
          <button
            type="button"
            className="hermesJobCardCancel"
            onClick={onCancel}
            title={job.status === "running" ? "停止执行" : "取消排队"}
          >
            取消
          </button>
        ) : null}
      </div>
      {(job.status === "running" || job.status === "done" || job.status === "failed") &&
      totalSteps > 0 ? (
        <div className="hermesJobCardProgressWrap">
          <div
            className="hermesJobCardProgressBar"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{ width: `${pct}%` }}
          />
          <span className="hermesJobCardProgressMeta">
            {doneCount}/{totalSteps} 步
          </span>
        </div>
      ) : null}
      {job.error ? (
        <p className="hermesJobCardError" title={job.error}>
          {job.error}
        </p>
      ) : null}
      {expanded && steps.length > 0 ? (
        <ol className="hermesJobStepList">
          {steps.map((step) => (
            <li
              key={step.id}
              className={`hermesJobStepRow hermesJobStepRow--${step.status}`}
            >
              <span className="hermesJobStepGlyph" aria-hidden>
                {stepStatusGlyph(step.status)}
              </span>
              <span className="hermesJobStepLabel">{step.label}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </li>
  );
}

type BackgroundRowProps = {
  task: HermesTask;
  onFocusNode?: (nodeId: string) => void;
};

function BackgroundRow({ task, onFocusNode }: BackgroundRowProps) {
  const clickable = Boolean(task.nodeId && onFocusNode);
  return (
    <li className={`hermesJobBgRow hermesJobBgRow--${task.status}`}>
      <button
        type="button"
        className="hermesJobBgRowMain"
        disabled={!clickable}
        title={task.error || task.label}
        onClick={() => task.nodeId && onFocusNode?.(task.nodeId)}
      >
        <span className="hermesJobBgLabel">{task.label}</span>
        <span className="hermesJobBgMeta">{statusLabel(task.status)}</span>
      </button>
    </li>
  );
}

type Props = {
  projectPath: string | null;
  /** sidebar=侧栏内嵌；drawer=ambient 抽屉全展开 */
  variant?: "sidebar" | "drawer";
};

export function HermesJobCenter({ projectPath, variant = "sidebar" }: Props) {
  const jobs = useHermesJobStore((s) => s.jobs);
  const cancelJob = useHermesJobStore((s) => s.cancelJob);
  const tasks = useHermesTaskStore((s) => s.tasks);
  const setSelectedNodeIds = useProjectStore((s) => s.setSelectedNodeIds);
  const requestFit = useCanvasUiStore((s) => s.requestCanvasFitToNode);

  const rows = useMemo(
    () => buildJobCenterRows(jobs, projectPath),
    [jobs, projectPath],
  );
  const backgroundTasks = useMemo(() => listBackgroundHermesTasks(tasks), [tasks]);
  const summary = useMemo(
    () => summarizeJobCenter(rows, backgroundTasks),
    [rows, backgroundTasks],
  );

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const defaultExpanded = useMemo(() => {
    const running = rows.find((r) => r.job.status === "running");
    if (running) return new Set([running.job.id]);
    const failed = rows.find((r) => r.job.status === "failed");
    if (failed) return new Set([failed.job.id]);
    return new Set<string>();
  }, [rows]);

  const effectiveExpanded = useMemo(() => {
    if (expandedIds.size > 0) return expandedIds;
    return defaultExpanded;
  }, [expandedIds, defaultExpanded]);

  if (rows.length === 0 && backgroundTasks.length === 0) {
    return variant === "drawer" ? (
      <p className="hermesJobDrawerEmpty">暂无进行中的制片任务</p>
    ) : null;
  }

  const toggleExpanded = (jobId: string) => {
    setExpandedIds((prev) => {
      const base = prev.size > 0 ? prev : new Set(defaultExpanded);
      const next = new Set(base);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const onFocusNode = (nodeId: string) => {
    setSelectedNodeIds([nodeId]);
    requestFit(nodeId);
  };

  return (
    <section
      className={`hermesJobCenter${variant === "drawer" ? " hermesJobCenter--drawer" : ""}`}
      aria-label="Hermes 制片任务中心"
    >
      {variant === "sidebar" ? (
        <div className="hermesJobCenterHead">
          <span className="hermesJobCenterTitle">制片任务</span>
          {summary ? <span className="hermesJobCenterSummary">{summary}</span> : null}
        </div>
      ) : null}

      {rows.length > 0 ? (
        <ul className="hermesJobList">
          {rows.map((row) => (
            <JobCard
              key={row.job.id}
              row={row}
              expanded={effectiveExpanded.has(row.job.id)}
              onToggle={() => toggleExpanded(row.job.id)}
              onCancel={
                row.job.status === "queued" || row.job.status === "running"
                  ? () => cancelJob(row.job.id)
                  : undefined
              }
            />
          ))}
        </ul>
      ) : null}

      {backgroundTasks.length > 0 ? (
        <div className="hermesJobCenterBg">
          <span className="hermesJobCenterBgTitle">后台</span>
          <ul className="hermesJobBgList">
            {backgroundTasks.map((t) => (
              <BackgroundRow key={t.id} task={t} onFocusNode={onFocusNode} />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
