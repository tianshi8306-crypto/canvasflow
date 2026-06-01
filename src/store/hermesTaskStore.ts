import { create } from "zustand";
import {
  applyAgentEvent,
  applyBatchProgress,
  applyDirectorSteps,
  countFailed,
  countRunning,
  finishBatchStep,
  patchDirectorStep,
  pruneTasks,
  type HermesTask,
  type HermesTaskKind,
  type HermesTaskStatus,
} from "@/lib/hermes/hermesTaskTrack";
import type { NodeAgentRuntimeEvent } from "@/lib/nodeAgentRuntime/types";

type HermesTaskState = {
  tasks: HermesTask[];
  upsertAgentEvent: (evt: NodeAgentRuntimeEvent, nodeLabel: string) => void;
  setDirectorSteps: (steps: Array<{ id: string; label: string }>) => void;
  patchDirectorStep: (stepId: string, status: HermesTaskStatus, error?: string) => void;
  reportBatchProgress: (
    directorStepId: string,
    opts: {
      kind: HermesTaskKind;
      label: string;
      current: number;
      total: number;
      detail?: string;
    },
  ) => void;
  finishBatchStep: (directorStepId: string, ok: boolean, message?: string) => void;
  setChatTask: (running: boolean) => void;
  upsertPlanJob: (
    jobId: string,
    label: string,
    status: HermesTaskStatus,
    opts?: { progress?: number; error?: string },
  ) => void;
  reset: () => void;
};

const CHAT_TASK_ID = "hermes:chat";

function planJobTaskId(jobId: string): string {
  return `planjob:${jobId}`;
}

export const useHermesTaskStore = create<HermesTaskState>((set) => ({
  tasks: [],

  upsertAgentEvent: (evt, nodeLabel) => {
    set((s) => ({ tasks: applyAgentEvent(s.tasks, evt, nodeLabel) }));
  },

  setDirectorSteps: (steps) => {
    set((s) => ({ tasks: applyDirectorSteps(s.tasks, steps) }));
  },

  patchDirectorStep: (stepId, status, error) => {
    set((s) => ({ tasks: patchDirectorStep(s.tasks, stepId, status, error) }));
  },

  reportBatchProgress: (directorStepId, opts) => {
    set((s) => ({ tasks: applyBatchProgress(s.tasks, directorStepId, opts) }));
  },

  finishBatchStep: (directorStepId, ok, message) => {
    set((s) => ({ tasks: finishBatchStep(s.tasks, directorStepId, ok, message) }));
  },

  setChatTask: (running) => {
    set((s) => {
      const without = s.tasks.filter((t) => t.id !== CHAT_TASK_ID);
      if (!running) {
        const prev = s.tasks.find((t) => t.id === CHAT_TASK_ID);
        if (!prev) return s;
        return {
          tasks: pruneTasks([
            { ...prev, status: "done", progress: 100, updatedAt: Date.now() },
            ...without,
          ]),
        };
      }
      return {
        tasks: pruneTasks([
          {
            id: CHAT_TASK_ID,
            kind: "llm",
            label: "Hermes 对话",
            status: "running",
            progress: 30,
            updatedAt: Date.now(),
          },
          ...without,
        ]),
      };
    });
  },

  upsertPlanJob: (jobId, label, status, opts) => {
    const id = planJobTaskId(jobId);
    set((s) => {
      const next: HermesTask = {
        id,
        kind: "director",
        label,
        status,
        progress: opts?.progress,
        error: opts?.error,
        updatedAt: Date.now(),
      };
      return { tasks: pruneTasks([next, ...s.tasks.filter((t) => t.id !== id)]) };
    });
  },

  reset: () => set({ tasks: [] }),
}));

/** 聚合计数；勿直接传入 useHermesTaskStore（每次返回新对象会触发无限重渲染），请用标量 selector 或 useShallow */
export function selectHermesTaskCounts(state: HermesTaskState): {
  running: number;
  failed: number;
  hasTasks: boolean;
} {
  return {
    running: countRunning(state.tasks),
    failed: countFailed(state.tasks),
    hasTasks: state.tasks.length > 0,
  };
}
