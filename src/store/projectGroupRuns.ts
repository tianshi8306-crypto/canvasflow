import { invoke, isTauri } from "@tauri-apps/api/core";
import { formatUserError } from "@/lib/errors";
import { DESKTOP_SHELL_HINT } from "@/lib/tauriEnv";
import {
  buildGroupExecutionSubgraph,
  collectGroupMediaRelPaths,
  countGroupMembers,
  fallbackGroupEntryNodeId,
  groupDisplayLabel,
} from "@/lib/canvasGroup";
import {
  deriveNodeRunStatesFromEvents,
  deriveRunFailureMessage,
  runHadAnyFailure,
} from "@/lib/runNodeState";
import { fetchRunEvents } from "@/shared/api/runs";
import type { GraphRunWithPatchResult, ProjectState } from "./projectStoreTypes";
import { scheduleSave } from "./projectSaveDebounce";

type SetState = (
  partial:
    | Partial<ProjectState>
    | ((state: ProjectState) => Partial<ProjectState> | ProjectState),
  replace?: false,
) => void;

async function applySubgraphRunResult(
  get: () => ProjectState,
  set: SetState,
  res: GraphRunWithPatchResult,
  statusPrefix: string,
): Promise<{ anyFail: boolean }> {
  const { projectPath } = get();
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
  if (!projectPath) {
    set({ lastRunId: runId, statusText: `${statusPrefix}：run ${runId}` });
    return { anyFail: false };
  }
  try {
    const events = await fetchRunEvents(projectPath, runId);
    const nodeRunStateById = deriveNodeRunStatesFromEvents(events);
    const anyFail = runHadAnyFailure(events);
    const failMsg = anyFail ? deriveRunFailureMessage(events) : null;
    set((s) => ({
      lastRunId: runId,
      nodeRunStateById: { ...s.nodeRunStateById, ...nodeRunStateById },
      statusText: anyFail
        ? `${statusPrefix}（部分失败）：${failMsg ?? "请查看运行日志"} · run ${runId}`
        : `${statusPrefix}：run ${runId}`,
    }));
    return { anyFail };
  } catch {
    set({ lastRunId: runId, statusText: `${statusPrefix}：run ${runId}（未能加载节点状态）` });
    return { anyFail: false };
  }
}

export function runGroupSubgraphImpl(get: () => ProjectState, set: SetState) {
  return async (groupId: string, force = false) => {
    if (!isTauri()) {
      get().setStatusText(DESKTOP_SHELL_HINT);
      return;
    }
    const { projectPath, nodes, edges, lastRunId, isGraphRunning } = get();
    if (isGraphRunning) return;
    if (!projectPath) {
      get().setStatusText("请先新建或打开工程目录");
      return;
    }
    const group = nodes.find((n) => n.id === groupId && n.type === "group");
    if (!group) {
      get().setStatusText("请先选中分组节点");
      return;
    }
    const { memberNodes, memberEdges, entryNodeIds } = buildGroupExecutionSubgraph(
      nodes,
      edges,
      groupId,
    );
    if (memberNodes.length === 0) {
      get().setStatusText("组内没有可执行节点");
      return;
    }
    const entries =
      entryNodeIds.length > 0
        ? entryNodeIds
        : [fallbackGroupEntryNodeId(memberNodes)].filter((id): id is string => Boolean(id));
    const label = groupDisplayLabel(group, countGroupMembers(nodes, groupId));
    set({
      isGraphRunning: true,
      statusText:
        entries.length > 1
          ? `组「${label}」执行中（${entries.length} 个入口依次执行）…`
          : `组「${label}」执行中…`,
    });
    const graph = { nodes: memberNodes, edges: memberEdges };
    let previousRunId = lastRunId;
    let anyFailOverall = false;
    try {
      for (let i = 0; i < entries.length; i++) {
        const fromNodeId = entries[i]!;
        if (entries.length > 1) {
          set({
            statusText: `组「${label}」执行中（入口 ${i + 1}/${entries.length}）…`,
          });
        }
        const res = await invoke<GraphRunWithPatchResult>("execute_subgraph_with_patch", {
          projectPath,
          graph,
          fromNodeId,
          previousRunId,
          force,
        });
        previousRunId = res.runId;
        const prefix =
          entries.length > 1
            ? `组「${label}」入口 ${i + 1}/${entries.length} 完成`
            : `组「${label}」执行完成`;
        const { anyFail } = await applySubgraphRunResult(get, set, res, prefix);
        if (anyFail) anyFailOverall = true;
      }
      if (entries.length > 1 && !anyFailOverall) {
        get().setStatusText(`组「${label}」全部入口执行完成`);
      }
    } catch (e) {
      set({ statusText: `组「${label}」执行失败：${formatUserError(e)}` });
    } finally {
      set({ isGraphRunning: false });
    }
  };
}

type ExportBatchResult = {
  copied: string[];
  skipped: string[];
};

export function exportGroupMediaImpl(get: () => ProjectState, set: SetState) {
  return async (groupId: string) => {
    if (!isTauri()) {
      get().setStatusText(DESKTOP_SHELL_HINT);
      return;
    }
    const { projectPath, nodes } = get();
    if (!projectPath) {
      get().setStatusText("请先新建或打开工程目录");
      return;
    }
    const group = nodes.find((n) => n.id === groupId && n.type === "group");
    if (!group) {
      get().setStatusText("请先选中分组节点");
      return;
    }
    const relPaths = collectGroupMediaRelPaths(nodes, groupId);
    if (relPaths.length === 0) {
      get().setStatusText("组内没有可导出的媒体文件（需已生成或导入 path）");
      return;
    }
    const label = groupDisplayLabel(group, countGroupMembers(nodes, groupId));
    set({ statusText: `正在导出组「${label}」媒体…` });
    try {
      const res = await invoke<ExportBatchResult>("export_project_assets_batch", {
        projectPath,
        relPaths,
        destFolderRel: "assets/export",
      });
      const copied = res.copied.length;
      const skipped = res.skipped.length;
      if (copied === 0) {
        set({
          statusText:
            skipped > 0
              ? `组「${label}」导出失败：${skipped} 个文件不存在或无法复制`
              : `组「${label}」没有可导出的文件`,
        });
        return;
      }
      set({
        statusText:
          skipped > 0
            ? `组「${label}」已导出 ${copied} 个到 assets/export/（跳过 ${skipped} 个）`
            : `组「${label}」已导出 ${copied} 个到 assets/export/`,
      });
    } catch (e) {
      set({ statusText: `组「${label}」导出失败：${formatUserError(e)}` });
    }
  };
}
