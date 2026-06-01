import type { Edge, Node, Viewport } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import type { GraphSnapshot, ProjectState } from "./projectStoreTypes";
import { scheduleSave } from "./projectSaveDebounce";
import { isProjectSaveInFlight } from "./projectSaveRunner";
import { useCanvasUiStore } from "./canvasUiStore";

const MAX_UNDO = 50;
const HISTORY_BURST_MS = 400;

let undoPast: GraphSnapshot[] = [];
let undoFuture: GraphSnapshot[] = [];
let historyBurstBaseline: GraphSnapshot | null = null;
let historyBurstTimer: number | undefined;
let applyingHistory = false;

export function getUndoRedoAvailability(): { canUndo: boolean; canRedo: boolean } {
  return {
    canUndo: undoPast.length > 0,
    canRedo: undoFuture.length > 0,
  };
}

/** 连续编辑防抖用：仅复制节点壳与坐标，避免 structuredClone 整图 data */
function cloneGraphShallow(get: () => ProjectState): GraphSnapshot {
  const { nodes, edges, viewport, graphRevision } = get();
  return {
    nodes: nodes.map((n) => ({
      ...n,
      position: { ...n.position },
    })) as Node<FlowNodeData>[],
    edges: edges.map((e) => ({ ...e })),
    viewport: { ...viewport },
    revision: graphRevision,
  };
}

/** 离散撤销用：深拷贝，保证 data 可安全回滚 */
export function cloneGraph(get: () => ProjectState): GraphSnapshot {
  const { nodes, edges, viewport, graphRevision } = get();
  const snap = { nodes, edges, viewport, revision: graphRevision };
  if (typeof structuredClone === "function") {
    return structuredClone(snap);
  }
  return {
    nodes: JSON.parse(JSON.stringify(nodes)) as Node<FlowNodeData>[],
    edges: JSON.parse(JSON.stringify(edges)) as Edge[],
    viewport: { ...viewport },
    revision: graphRevision,
  };
}

/** 与 React Flow 内部浮点一致时跳过，避免程序化 setViewport 触发 onMoveEnd 时再记一条撤销 */
export function viewportNearlyEqual(a: Viewport, b: Viewport): boolean {
  return (
    Math.abs(a.x - b.x) < 0.5 &&
    Math.abs(a.y - b.y) < 0.5 &&
    Math.abs(a.zoom - b.zoom) < 0.0001
  );
}

export function isHistoryBurstPending(): boolean {
  return historyBurstTimer !== undefined;
}

export function flushHistoryBurst(get: () => ProjectState) {
  window.clearTimeout(historyBurstTimer);
  historyBurstTimer = undefined;
  if (!historyBurstBaseline || applyingHistory) {
    historyBurstBaseline = null;
    return;
  }
  const rev = get().graphRevision;
  if (rev !== historyBurstBaseline.revision) {
    undoPast.push(historyBurstBaseline);
    while (undoPast.length > MAX_UNDO) undoPast.shift();
    undoFuture = [];
  }
  historyBurstBaseline = null;
}

export function scheduleHistoryBurst(get: () => ProjectState) {
  if (applyingHistory) return;
  if (!historyBurstBaseline) historyBurstBaseline = cloneGraphShallow(get);
  window.clearTimeout(historyBurstTimer);
  historyBurstTimer = window.setTimeout(() => {
    historyBurstTimer = undefined;
    flushHistoryBurst(get);
  }, HISTORY_BURST_MS);
}

/** 离散操作前调用：先落盘当前防抖中的连续编辑，再记录本次操作前的快照 */
export function recordBeforeDiscreteMutation(get: () => ProjectState) {
  if (applyingHistory) return;
  flushHistoryBurst(get);
  undoPast.push(cloneGraph(get));
  while (undoPast.length > MAX_UNDO) undoPast.shift();
  undoFuture = [];
}

export function clearHistoryStacks() {
  undoPast = [];
  undoFuture = [];
  historyBurstBaseline = null;
  window.clearTimeout(historyBurstTimer);
  historyBurstTimer = undefined;
}

export function runUndo(get: () => ProjectState, set: (partial: Partial<ProjectState>) => void) {
  flushHistoryBurst(get);
  if (undoPast.length === 0) {
    get().setStatusText("没有可撤销的操作");
    return;
  }
  applyingHistory = true;
  const prev = undoPast.pop()!;
  undoFuture.unshift(cloneGraph(get));
  set({
    nodes: prev.nodes,
    edges: prev.edges,
    viewport: prev.viewport,
    selectedNodeId: null,
    selectedNodeIds: [],
    selectedEdgeIds: [],
    statusText: "已撤销",
    projectDirty: true,
    graphRevision: prev.revision,
  });
  applyingHistory = false;
  if (get().projectPath) scheduleSave(get);
}

export function runRedo(get: () => ProjectState, set: (partial: Partial<ProjectState>) => void) {
  flushHistoryBurst(get);
  if (undoFuture.length === 0) {
    get().setStatusText("没有可重做的操作");
    return;
  }
  applyingHistory = true;
  const next = undoFuture.shift()!;
  undoPast.push(cloneGraph(get));
  while (undoPast.length > MAX_UNDO) undoPast.shift();
  set({
    nodes: next.nodes,
    edges: next.edges,
    viewport: next.viewport,
    selectedNodeId: null,
    selectedNodeIds: [],
    selectedEdgeIds: [],
    statusText: "已重做",
    projectDirty: true,
    graphRevision: next.revision,
  });
  applyingHistory = false;
  if (get().projectPath) scheduleSave(get);
}

/** 拖拽 / 撤销防抖 / 保存进行中时推迟自动保存，避免与编辑争抢主线程 */
export function shouldDeferProjectAutoSave(): boolean {
  if (useCanvasUiStore.getState().nodeDragSuppressUi) return true;
  if (isHistoryBurstPending()) return true;
  if (isProjectSaveInFlight()) return true;
  return false;
}
