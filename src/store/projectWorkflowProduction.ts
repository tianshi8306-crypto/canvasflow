import { isTauri } from "@tauri-apps/api/core";
import {
  buildNodesFromWorkflowSnapshot,
  buildWorkflowSnapshotFromSelection,
  loadLocalWorkflows,
  MAX_LOCAL_WORKFLOWS,
  MAX_WORKFLOW_NODES,
  normalizeInsertedWorkflowNodes,
  saveLocalWorkflows,
  WORKFLOW_REL_DIR,
  type CanvasWorkflowSnapshotV1,
} from "@/lib/canvasWorkflowSnapshot";
import { formatUserError } from "@/lib/errors";
import {
  deleteProjectWorkflowFile,
  readProjectWorkflow,
  writeProjectWorkflow,
} from "@/shared/api/workflows";
import type { ProjectState } from "./projectStoreTypes";
import { recordBeforeDiscreteMutation } from "./projectHistory";
import { scheduleSave } from "./projectSaveDebounce";

type SetState = (
  partial:
    | Partial<ProjectState>
    | ((state: ProjectState) => Partial<ProjectState> | ProjectState),
  replace?: false,
) => void;

export type SaveWorkflowTargets = {
  local: boolean;
  project: boolean;
};

async function loadWorkflowById(
  projectPath: string | null,
  id: string,
  relPath?: string,
): Promise<CanvasWorkflowSnapshotV1 | null> {
  if (projectPath && relPath && isTauri()) {
    try {
      const raw = await readProjectWorkflow(projectPath, relPath);
      const parsed = JSON.parse(raw) as CanvasWorkflowSnapshotV1;
      if (parsed.version === 1) return parsed;
    } catch {
      /* try local */
    }
  }
  return loadLocalWorkflows().find((w) => w.id === id) ?? null;
}

export function saveWorkflowFromSelectionImpl(get: () => ProjectState, _set: SetState) {
  return async (
    name: string,
    targets: SaveWorkflowTargets,
    selectedNodeIds?: string[],
  ) => {
    const { nodes, edges, projectPath, selectedNodeIds: storeSel } = get();
    const ids = selectedNodeIds ?? storeSel;
    if (ids.length === 0) {
      get().setStatusText("请先框选至少 1 个节点");
      return;
    }
    if (!targets.local && !targets.project) {
      get().setStatusText("请至少选择「本机」或「当前工程」之一");
      return;
    }
    if (targets.project && (!projectPath || !isTauri())) {
      get().setStatusText("请先打开工程后再保存到工程库");
      return;
    }

    const snap = buildWorkflowSnapshotFromSelection(nodes, edges, ids, name);
    if (!snap) {
      get().setStatusText(`无法保存：选区无效或超过 ${MAX_WORKFLOW_NODES} 个节点`);
      return;
    }

    const content = JSON.stringify(snap, null, 2);
    const saved: string[] = [];

    try {
      if (targets.local) {
        const local = loadLocalWorkflows();
        const next = [snap, ...local.filter((w) => w.id !== snap.id)].slice(0, MAX_LOCAL_WORKFLOWS);
        saveLocalWorkflows(next);
        saved.push("本机");
      }
      if (targets.project && projectPath) {
        const relPath = `${WORKFLOW_REL_DIR}/${snap.id}.json`;
        await writeProjectWorkflow(projectPath, relPath, content);
        saved.push("工程");
      }
      get().setStatusText(`已保存工作流「${snap.name}」→ ${saved.join(" + ")}`);
    } catch (e) {
      get().setStatusText(`保存工作流失败：${formatUserError(e)}`);
    }
  };
}

export function insertWorkflowImpl(get: () => ProjectState, set: SetState) {
  return async (
    workflowId: string,
    worldPosition: { x: number; y: number },
    relPath?: string,
  ) => {
    const { projectPath } = get();
    const snap = await loadWorkflowById(projectPath, workflowId, relPath);
    if (!snap || snap.version !== 1) {
      get().setStatusText("工作流不存在或格式无效");
      return;
    }
    recordBeforeDiscreteMutation(get);
    const { nextNodes, nextEdges } = buildNodesFromWorkflowSnapshot(snap, worldPosition);
    const { nodes: mergedNodes, selectedIds } = normalizeInsertedWorkflowNodes(nextNodes);
    set((s) => ({
      nodes: [
        ...s.nodes.map((n) => ({ ...n, selected: selectedIds.includes(n.id) })),
        ...mergedNodes,
      ],
      edges: [...s.edges, ...nextEdges],
      selectedNodeIds: selectedIds,
      selectedNodeId: selectedIds[0] ?? null,
      selectedEdgeIds: [],
      statusText: `已插入工作流：${snap.name}`,
    }));
    if (get().projectPath) scheduleSave(get);
  };
}

export function deleteWorkflowImpl(get: () => ProjectState, _set: SetState) {
  return async (workflowId: string, opts: { local?: boolean; relPath?: string }) => {
    const { projectPath } = get();
    try {
      if (opts.local) {
        saveLocalWorkflows(loadLocalWorkflows().filter((w) => w.id !== workflowId));
      }
      if (opts.relPath && projectPath && isTauri()) {
        await deleteProjectWorkflowFile(projectPath, opts.relPath);
      }
      get().setStatusText("已删除工作流");
    } catch (e) {
      get().setStatusText(`删除失败：${formatUserError(e)}`);
    }
  };
}
