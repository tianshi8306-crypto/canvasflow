import { invoke, isTauri } from "@tauri-apps/api/core";
import { formatUserError } from "@/lib/errors";
import { DESKTOP_SHELL_HINT } from "@/lib/tauriEnv";
import {
  deriveNodeRunStatesFromEvents,
  deriveRunFailureMessage,
  runHadAnyFailure,
} from "@/lib/runNodeState";
import { enabledEdges } from "@/lib/edgeState";
import { fetchRunEvents } from "@/shared/api/runs";
import type { GraphRunWithPatchResult, ProjectState } from "./projectStoreTypes";
import { scheduleSave } from "./projectSaveDebounce";

type SetState = (
  partial:
    | Partial<ProjectState>
    | ((state: ProjectState) => Partial<ProjectState> | ProjectState),
  replace?: false,
) => void;

export function runWorkflowImpl(get: () => ProjectState, set: SetState) {
  return async () => {
    if (!isTauri()) {
      get().setStatusText(DESKTOP_SHELL_HINT);
      return;
    }
    const { projectPath, nodes, edges } = get();
    if (!projectPath) {
      get().setStatusText("请先新建或打开工程目录");
      return;
    }
    get().setStatusText("正在执行工作流…");
    set({ nodeRunStateById: {}, isGraphRunning: true });
    const graph = { nodes, edges: enabledEdges(edges) };
    try {
      const res = await invoke<GraphRunWithPatchResult>("execute_graph_with_patch", { projectPath, graph });
      const runId = res.runId;
      if (res.nodePatches.length > 0) {
        set((s) => ({
          nodes: s.nodes.map((n) => {
            const p = res.nodePatches.find((x) => x.nodeId === n.id);
            if (!p) return n;
            return { ...n, data: { ...n.data, ...p.dataPatch } };
          }),
        }));
        if (get().projectPath) scheduleSave(get);
      }
      try {
        const events = await fetchRunEvents(projectPath, runId);
        const nodeRunStateById = deriveNodeRunStatesFromEvents(events);
        const anyFail = runHadAnyFailure(events);
        set({
          lastRunId: runId,
          nodeRunStateById,
          statusText: anyFail ? `完成（部分失败）：run ${runId}` : `完成：run ${runId}`,
        });
      } catch {
        set({
          lastRunId: runId,
          nodeRunStateById: {},
          statusText: `完成：run ${runId}（未能加载节点状态）`,
        });
      }
    } catch (e) {
      set({ statusText: `执行失败：${formatUserError(e)}` });
    } finally {
      set({ isGraphRunning: false });
    }
  };
}

export function runNodeSubgraphImpl(get: () => ProjectState, set: SetState) {
  return async (fromNodeId: string, force = false) => {
    if (!isTauri()) {
      get().setStatusText(DESKTOP_SHELL_HINT);
      return;
    }
    const { projectPath, nodes, edges, lastRunId } = get();
    if (!projectPath) {
      get().setStatusText("请先新建或打开工程目录");
      return;
    }
    const nodeExists = nodes.some((n) => n.id === fromNodeId);
    if (!nodeExists) {
      get().setStatusText("节点不存在，无法触发执行");
      return;
    }
    set({ statusText: `正在从节点 ${fromNodeId.slice(0, 8)} 触发子图执行…`, isGraphRunning: true });
    const graph = { nodes, edges: enabledEdges(edges) };
    try {
      const res = await invoke<GraphRunWithPatchResult>("execute_subgraph_with_patch", {
        projectPath,
        graph,
        fromNodeId,
        previousRunId: lastRunId,
        force,
      });
      const runId = res.runId;
      if (res.nodePatches.length > 0) {
        set((s) => ({
          nodes: s.nodes.map((n) => {
            const p = res.nodePatches.find((x) => x.nodeId === n.id);
            if (!p) return n;
            return { ...n, data: { ...n.data, ...p.dataPatch } };
          }),
        }));
        if (get().projectPath) scheduleSave(get);
      }
      try {
        const events = await fetchRunEvents(projectPath, runId);
        const nodeRunStateById = deriveNodeRunStatesFromEvents(events);
        const anyFail = runHadAnyFailure(events);
        const failMsg = anyFail ? deriveRunFailureMessage(events) : null;
        set({
          lastRunId: runId,
          nodeRunStateById,
          statusText: anyFail
            ? `子图执行完成（部分失败）：${failMsg ?? "请查看运行日志"} · run ${runId}`
            : `子图执行完成：run ${runId}`,
        });
      } catch {
        set({
          lastRunId: runId,
          statusText: `子图执行完成：run ${runId}（未能加载节点状态）`,
        });
      }
    } catch (e) {
      set({ statusText: `子图执行失败：${formatUserError(e)}` });
    } finally {
      set({ isGraphRunning: false });
    }
  };
}

export function rerunFailedSubgraphImpl(get: () => ProjectState, set: SetState) {
  return async (force = false) => {
    if (!isTauri()) {
      get().setStatusText(DESKTOP_SHELL_HINT);
      return;
    }
    const { projectPath, nodes, edges, lastRunId, nodeRunStateById } = get();
    if (!projectPath) {
      get().setStatusText("请先新建或打开工程目录");
      return;
    }
    const failedNodeId = Object.entries(nodeRunStateById).find(([, st]) => st === "failed")?.[0];
    if (!failedNodeId) {
      get().setStatusText("最近一次运行没有失败节点");
      return;
    }

    set({ statusText: `正在重跑子图：${failedNodeId}…`, isGraphRunning: true });
    const graph = { nodes, edges: enabledEdges(edges) };
    try {
      const res = await invoke<GraphRunWithPatchResult>("execute_subgraph_with_patch", {
        projectPath,
        graph,
        fromNodeId: failedNodeId,
        previousRunId: lastRunId,
        force,
      });
      const runId = res.runId;
      if (res.nodePatches.length > 0) {
        set((s) => ({
          nodes: s.nodes.map((n) => {
            const p = res.nodePatches.find((x) => x.nodeId === n.id);
            if (!p) return n;
            return { ...n, data: { ...n.data, ...p.dataPatch } };
          }),
        }));
        if (get().projectPath) scheduleSave(get);
      }
      try {
        const events = await fetchRunEvents(projectPath, runId);
        const nextStates = deriveNodeRunStatesFromEvents(events);
        const anyFail = runHadAnyFailure(events);
        const failMsg = anyFail ? deriveRunFailureMessage(events) : null;
        set({
          lastRunId: runId,
          nodeRunStateById: nextStates,
          statusText: anyFail
            ? `子图重跑完成（部分失败）：${failMsg ?? "请查看运行日志"} · run ${runId}`
            : `子图重跑完成：run ${runId}`,
        });
      } catch {
        set({
          lastRunId: runId,
          statusText: `子图重跑完成：run ${runId}（未能加载节点状态）`,
        });
      }
    } catch (e) {
      set({ statusText: `子图重跑失败：${formatUserError(e)}` });
    } finally {
      set({ isGraphRunning: false });
    }
  };
}
