import { useMemo } from "react";
import type { HermesTask, HermesTaskStatus } from "@/lib/hermes/hermesTaskTrack";
import { countFailed, countRunning } from "@/lib/hermes/hermesTaskTrack";
import { useHermesTaskStore } from "@/store/hermesTaskStore";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";

function statusLabel(status: HermesTaskStatus): string {
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

function kindIcon(kind: HermesTask["kind"]): string {
  switch (kind) {
    case "image":
      return "图";
    case "video":
      return "视";
    case "llm":
      return "文";
    case "director":
      return "计";
    default:
      return "·";
  }
}

type RowProps = {
  task: HermesTask;
  onFocusNode?: (nodeId: string) => void;
};

function TaskRow({ task, onFocusNode }: RowProps) {
  const clickable = Boolean(task.nodeId && onFocusNode);
  return (
    <li className={`hermesTaskRow hermesTaskRow--${task.status}`}>
      <button
        type="button"
        className="hermesTaskRowMain"
        disabled={!clickable}
        title={task.error || task.label}
        onClick={() => task.nodeId && onFocusNode?.(task.nodeId)}
      >
        <span className="hermesTaskKind" aria-hidden>
          {kindIcon(task.kind)}
        </span>
        <span className="hermesTaskBody">
          <span className="hermesTaskLabel">{task.label}</span>
          <span className="hermesTaskMeta">{statusLabel(task.status)}</span>
          {task.status === "running" && task.progress != null ? (
            <span
              className="hermesTaskProgress"
              style={{ width: `${Math.min(100, task.progress)}%` }}
              role="progressbar"
              aria-valuenow={task.progress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          ) : null}
        </span>
      </button>
    </li>
  );
}

export function HermesTaskTrack() {
  const tasks = useHermesTaskStore((s) => s.tasks);
  const running = useHermesTaskStore((s) => countRunning(s.tasks));
  const failed = useHermesTaskStore((s) => countFailed(s.tasks));
  const setSelectedNodeIds = useProjectStore((s) => s.setSelectedNodeIds);
  const requestFit = useCanvasUiStore((s) => s.requestCanvasFitToNode);

  const sorted = useMemo(
    () =>
      [...tasks].sort((a, b) => {
        const order: Record<HermesTaskStatus, number> = {
          running: 0,
          queued: 1,
          failed: 2,
          done: 3,
        };
        const d = order[a.status] - order[b.status];
        if (d !== 0) return d;
        return b.updatedAt - a.updatedAt;
      }),
    [tasks],
  );

  if (sorted.length === 0) return null;

  const onFocusNode = (nodeId: string) => {
    setSelectedNodeIds([nodeId]);
    requestFit(nodeId);
  };

  return (
    <section className="hermesTaskTrack" aria-label="Hermes 后台任务">
      <div className="hermesTaskTrackHead">
        <span className="hermesTaskTrackTitle">任务</span>
        <span className="hermesTaskTrackSummary">
          {running > 0 ? `${running} 进行中` : null}
          {running > 0 && failed > 0 ? " · " : null}
          {failed > 0 ? `${failed} 失败` : null}
          {running === 0 && failed === 0 ? "最近完成" : null}
        </span>
      </div>
      <ul className="hermesTaskList">
        {sorted.map((t) => (
          <TaskRow key={t.id} task={t} onFocusNode={onFocusNode} />
        ))}
      </ul>
    </section>
  );
}
