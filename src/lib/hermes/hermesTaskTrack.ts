import type { NodeAgentPhase, NodeAgentRuntimeEvent } from "@/lib/nodeAgentRuntime/types";

export type HermesTaskStatus = "queued" | "running" | "done" | "failed";

export type HermesTaskKind = "image" | "video" | "llm" | "director" | "other";

export type HermesTask = {
  id: string;
  kind: HermesTaskKind;
  label: string;
  status: HermesTaskStatus;
  progress?: number;
  error?: string;
  nodeId?: string;
  agentName?: string;
  updatedAt: number;
};

const MAX_TASKS = 16;
const DONE_TTL_MS = 45_000;

export function agentKindFromName(agentName: string): HermesTaskKind {
  if (agentName.includes("图片") || agentName.includes("文生图") || agentName.includes("图生图")) {
    return "image";
  }
  if (agentName.includes("视频")) return "video";
  if (agentName.includes("分镜") || agentName.includes("脚本")) return "llm";
  return "other";
}

/** 从脚本节点数据解析镜头标签，供任务轨展示 */
export function labelForAgentNode(
  node:
    | {
        type?: string;
        data?: {
          label?: string;
          params?: Record<string, unknown>;
        };
      }
    | undefined,
  scriptBeats: Array<{ id: string; shotNumber?: string }> | undefined,
  fallback: string,
): string {
  const custom = node?.data?.label?.trim();
  if (custom) return custom;
  const params = node?.data?.params;
  const beatId =
    typeof params?.scriptBeatId === "string" ? params.scriptBeatId.trim() : "";
  if (beatId && scriptBeats?.length) {
    const beat = scriptBeats.find((b) => b.id === beatId);
    const num = beat?.shotNumber?.trim();
    if (num) {
      const kind =
        node?.type === "imageNode" ? "图" : node?.type === "videoNode" ? "视" : "镜";
      return `镜 ${num}·${kind}`;
    }
  }
  if (node?.type === "imageNode") return "图片节点";
  if (node?.type === "videoNode") return "视频节点";
  return fallback;
}

export function statusFromAgentPhase(phase: NodeAgentPhase): HermesTaskStatus | null {
  if (phase === "error") return "failed";
  if (phase === "end") return "done";
  if (phase === "start" || phase === "sense" || phase === "execute" || phase === "validate" || phase === "commit") {
    return "running";
  }
  return null;
}

export function progressFromAgentPhase(phase: NodeAgentPhase): number {
  switch (phase) {
    case "start":
      return 12;
    case "sense":
      return 28;
    case "execute":
      return 52;
    case "validate":
      return 72;
    case "commit":
      return 88;
    case "end":
      return 100;
    default:
      return 0;
  }
}

export function taskIdForAgent(nodeId: string): string {
  return `agent:${nodeId}`;
}

export function taskIdForDirectorStep(stepId: string): string {
  return `director:${stepId}`;
}

export function taskIdForBatchStep(directorStepId: string): string {
  return `batch:${directorStepId}`;
}

export function isBatchToolId(toolId: string): boolean {
  return (
    toolId === "image.generate_for_beats" ||
    toolId === "image.retry_failed" ||
    toolId === "video.generate_for_beats" ||
    toolId === "video.retry_failed"
  );
}

export function applyBatchProgress(
  tasks: HermesTask[],
  directorStepId: string,
  opts: {
    kind: HermesTaskKind;
    label: string;
    current: number;
    total: number;
    detail?: string;
  },
): HermesTask[] {
  const id = taskIdForBatchStep(directorStepId);
  const progress =
    opts.total > 0 ? Math.round((opts.current / opts.total) * 100) : undefined;
  const label =
    opts.total > 0
      ? `${opts.label}（${opts.current}/${opts.total}${opts.detail ? ` · ${opts.detail}` : ""}）`
      : opts.label;
  const next: HermesTask = {
    id,
    kind: opts.kind,
    label,
    status: opts.current >= opts.total && opts.total > 0 ? "running" : "running",
    progress,
    updatedAt: Date.now(),
  };
  return pruneTasks([next, ...tasks.filter((t) => t.id !== id)]);
}

export function finishBatchStep(
  tasks: HermesTask[],
  directorStepId: string,
  ok: boolean,
  message?: string,
): HermesTask[] {
  const id = taskIdForBatchStep(directorStepId);
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return tasks;
  const copy = [...tasks];
  copy[idx] = {
    ...copy[idx]!,
    status: ok ? "done" : "failed",
    error: ok ? undefined : message,
    progress: ok ? 100 : copy[idx]!.progress,
    updatedAt: Date.now(),
  };
  return pruneTasks(copy);
}

export function applyAgentEvent(
  tasks: HermesTask[],
  evt: NodeAgentRuntimeEvent,
  nodeLabel: string,
): HermesTask[] {
  const status = statusFromAgentPhase(evt.phase);
  if (!status) return tasks;

  const id = taskIdForAgent(evt.nodeId);
  const kind = agentKindFromName(evt.agentName);
  const label = nodeLabel.trim() || evt.agentName;
  const next: HermesTask = {
    id,
    kind,
    label,
    status,
    progress: progressFromAgentPhase(evt.phase),
    error: evt.error,
    nodeId: evt.nodeId,
    agentName: evt.agentName,
    updatedAt: Date.now(),
  };

  const merged = [next, ...tasks.filter((t) => t.id !== id)];
  return pruneTasks(merged);
}

export function applyDirectorSteps(
  tasks: HermesTask[],
  steps: Array<{ id: string; label: string }>,
): HermesTask[] {
  const directorIds = new Set(steps.map((s) => taskIdForDirectorStep(s.id)));
  const kept = tasks.filter((t) => t.kind !== "director" || directorIds.has(t.id));
  const added = steps.map((s) => {
    const id = taskIdForDirectorStep(s.id);
    const existing = kept.find((t) => t.id === id);
    return (
      existing ?? {
        id,
        kind: "director" as const,
        label: s.label,
        status: "queued" as const,
        updatedAt: Date.now(),
      }
    );
  });
  return pruneTasks([...added, ...kept.filter((t) => t.kind !== "director")]);
}

export function patchDirectorStep(
  tasks: HermesTask[],
  stepId: string,
  status: HermesTaskStatus,
  error?: string,
): HermesTask[] {
  const id = taskIdForDirectorStep(stepId);
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return tasks;
  const copy = [...tasks];
  copy[idx] = {
    ...copy[idx]!,
    status,
    error,
    progress: status === "done" ? 100 : status === "running" ? 40 : copy[idx]!.progress,
    updatedAt: Date.now(),
  };
  return pruneTasks(copy);
}

export function pruneTasks(tasks: HermesTask[]): HermesTask[] {
  const now = Date.now();
  const filtered = tasks.filter(
    (t) => t.status !== "done" || now - t.updatedAt < DONE_TTL_MS,
  );
  filtered.sort((a, b) => b.updatedAt - a.updatedAt);
  return filtered.slice(0, MAX_TASKS);
}

export function countRunning(tasks: HermesTask[]): number {
  return tasks.filter((t) => t.status === "running" || t.status === "queued").length;
}

export function countFailed(tasks: HermesTask[]): number {
  return tasks.filter((t) => t.status === "failed").length;
}
