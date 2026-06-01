import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { cloneFlowNodeData } from "@/lib/flowNodeDataClone";
import {
  buildGroupTemplateSnapshot,
  buildNodesFromGroupTemplate,
  type CanvasGroupTemplateEdgeV1,
  type CanvasGroupTemplateNodeV1,
  type CanvasGroupTemplateV1,
} from "@/lib/canvasGroupTemplate";
import { collectGroupSubtreeIds } from "@/lib/canvasGroupDuplicate";
import {
  buildPasteEdgesFromClipboard,
  buildPasteNodesFromClipboard,
} from "@/lib/buildPasteNodesFromClipboard";
import { normalizeGroupNodesForCanvas } from "@/lib/canvasGroup";

export const CANVAS_WORKFLOWS_STORAGE_KEY = "canvasflow.workflows.v1";
export const WORKFLOW_REL_DIR = ".canvasflow/workflows";
export const MAX_LOCAL_WORKFLOWS = 80;
export const MAX_WORKFLOW_NODES = 200;

export type CanvasWorkflowSnapshotV1 = {
  version: 1;
  id: string;
  name: string;
  createdAt: number;
  kind: "selection" | "group";
  group?: CanvasGroupTemplateV1["group"];
  nodes: CanvasGroupTemplateNodeV1[];
  edges: CanvasGroupTemplateEdgeV1[];
};

export type CanvasWorkflowListItem = {
  id: string;
  name: string;
  createdAt: number;
  nodeCount: number;
  edgeCount: number;
  kind: CanvasWorkflowSnapshotV1["kind"];
  /** 本机库 */
  local?: boolean;
  /** 工程内相对路径 */
  relPath?: string;
};

const SENSITIVE_PARAM_KEYS = new Set([
  "apiKey",
  "api_key",
  "token",
  "accessToken",
  "secret",
]);

export function sanitizeWorkflowNodeData(data: FlowNodeData): FlowNodeData {
  const next = cloneFlowNodeData(data);
  delete next.path;
  delete next.assetId;
  delete next.imageWidth;
  delete next.imageHeight;
  delete next.status;
  if (next.params && typeof next.params === "object") {
    const p = { ...next.params } as Record<string, unknown>;
    for (const key of Object.keys(p)) {
      if (SENSITIVE_PARAM_KEYS.has(key)) delete p[key];
    }
    next.params = p;
  }
  if (next.video?.draft) {
    next.video = {
      ...next.video,
      draft: { ...next.video.draft, prompt: next.video.draft.prompt ?? "" },
    };
  }
  return next;
}

export function collectSelectionNodeIds(
  selectedNodeIds: string[],
  nodes: Node<FlowNodeData>[],
): Set<string> {
  const ids = new Set(selectedNodeIds);
  for (const id of selectedNodeIds) {
    const hit = nodes.find((x) => x.id === id);
    if (hit?.type === "group") {
      for (const sid of collectGroupSubtreeIds(nodes, id)) {
        ids.add(sid);
      }
    }
  }
  return ids;
}

function nodeAbsolutePosition(
  node: Node<FlowNodeData>,
  nodeById: Map<string, Node<FlowNodeData>>,
): { x: number; y: number } {
  if (!node.parentId) return { ...node.position };
  const parent = nodeById.get(node.parentId);
  if (!parent) return { ...node.position };
  const pp = nodeAbsolutePosition(parent, nodeById);
  return { x: pp.x + node.position.x, y: pp.y + node.position.y };
}

function tryBuildGroupWorkflow(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  ids: Set<string>,
  name: string,
): CanvasWorkflowSnapshotV1 | null {
  const groups = nodes.filter((n) => ids.has(n.id) && n.type === "group");
  if (groups.length !== 1) return null;
  const groupId = groups[0]!.id;
  const nonGroup = [...ids].filter((id) => {
    const n = nodes.find((x) => x.id === id);
    return n && n.type !== "group" && n.parentId !== groupId;
  });
  if (nonGroup.length > 0) return null;
  const tpl = buildGroupTemplateSnapshot(nodes, edges, groupId, name);
  if (!tpl) return null;
  return {
    version: 1,
    id: tpl.id,
    name: tpl.name,
    createdAt: tpl.createdAt,
    kind: "group",
    group: tpl.group,
    nodes: tpl.nodes,
    edges: tpl.edges,
  };
}

export function buildWorkflowSnapshotFromSelection(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  selectedNodeIds: string[],
  name: string,
): CanvasWorkflowSnapshotV1 | null {
  if (selectedNodeIds.length === 0) return null;
  const ids = collectSelectionNodeIds(selectedNodeIds, nodes);
  const picked = nodes.filter((n) => ids.has(n.id));
  if (picked.length === 0) return null;
  if (picked.length > MAX_WORKFLOW_NODES) return null;

  const trimmedName = name.trim() || "工作流";
  const groupSnap = tryBuildGroupWorkflow(nodes, edges, ids, trimmedName);
  if (groupSnap) return groupSnap;

  const nodeById = new Map(picked.map((n) => [n.id, n]));
  const absPositions = new Map<string, { x: number; y: number }>();
  for (const n of picked) {
    absPositions.set(n.id, nodeAbsolutePosition(n, nodeById));
  }
  let minX = Infinity;
  let minY = Infinity;
  for (const p of absPositions.values()) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
  }
  if (!Number.isFinite(minX)) return null;

  const memberIds = new Set(picked.map((n) => n.id));
  return {
    version: 1,
    id: crypto.randomUUID(),
    name: trimmedName,
    createdAt: Date.now(),
    kind: "selection",
    nodes: picked.map((n) => {
      const abs = absPositions.get(n.id)!;
      return {
        localId: n.id,
        type: n.type ?? "imageNode",
        position: { x: abs.x - minX, y: abs.y - minY },
        data: sanitizeWorkflowNodeData(n.data),
        style: n.style,
        width: n.width,
        height: n.height,
      };
    }),
    edges: edges
      .filter((e) => memberIds.has(e.source) && memberIds.has(e.target))
      .map((e) => ({
        sourceLocalId: e.source,
        targetLocalId: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        data: e.data,
      })),
  };
}

function workflowToGroupTemplate(snap: CanvasWorkflowSnapshotV1): CanvasGroupTemplateV1 | null {
  if (snap.kind !== "group" || !snap.group) return null;
  return {
    version: 1,
    id: snap.id,
    name: snap.name,
    createdAt: snap.createdAt,
    group: snap.group,
    nodes: snap.nodes,
    edges: snap.edges,
  };
}

function bboxOfSnapshotNodes(nodes: CanvasGroupTemplateNodeV1[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x);
    maxY = Math.max(maxY, n.position.y);
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, width: 0, height: 0 };
  }
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

export function buildNodesFromWorkflowSnapshot(
  snap: CanvasWorkflowSnapshotV1,
  worldPosition: { x: number; y: number },
): { nextNodes: Node<FlowNodeData>[]; nextEdges: Edge[] } {
  const groupTpl = workflowToGroupTemplate(snap);
  if (groupTpl) {
    return buildNodesFromGroupTemplate(groupTpl, worldPosition);
  }

  const { width, height, minX, minY } = bboxOfSnapshotNodes(snap.nodes);
  const offsetX = worldPosition.x - (minX + width / 2);
  const offsetY = worldPosition.y - (minY + height / 2);

  const copiedNodes: Node<FlowNodeData>[] = snap.nodes.map((n) => ({
    id: n.localId,
    type: n.type,
    position: { x: n.position.x, y: n.position.y },
    data: cloneFlowNodeData(n.data),
    style: n.style,
    width: n.width,
    height: n.height,
    draggable: true,
    selectable: true,
  }));

  const copiedEdges: Edge[] = snap.edges.map((e, i) => ({
    id: `wf-edge-${i}`,
    source: e.sourceLocalId,
    target: e.targetLocalId,
    sourceHandle: e.sourceHandle ?? "out",
    targetHandle: e.targetHandle ?? "in",
    data: e.data,
  }));

  const { nextNodes, idMap } = buildPasteNodesFromClipboard(
    { copiedNodes, copiedEdges },
    0,
  );
  const shifted = nextNodes.map((n) => ({
    ...n,
    position: {
      x: n.position.x + offsetX,
      y: n.position.y + offsetY,
    },
  }));
  const nextEdges = buildPasteEdgesFromClipboard(copiedEdges, idMap, shifted);
  return { nextNodes: shifted, nextEdges };
}

export function loadLocalWorkflows(): CanvasWorkflowSnapshotV1[] {
  try {
    const raw = localStorage.getItem(CANVAS_WORKFLOWS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { workflows?: CanvasWorkflowSnapshotV1[] };
    return Array.isArray(parsed.workflows) ? parsed.workflows : [];
  } catch {
    return [];
  }
}

export function saveLocalWorkflows(workflows: CanvasWorkflowSnapshotV1[]): void {
  localStorage.setItem(
    CANVAS_WORKFLOWS_STORAGE_KEY,
    JSON.stringify({ version: 1, workflows }),
  );
}

export function workflowToListItem(
  snap: CanvasWorkflowSnapshotV1,
  opts: { local?: boolean; relPath?: string },
): CanvasWorkflowListItem {
  return {
    id: snap.id,
    name: snap.name,
    createdAt: snap.createdAt,
    nodeCount: snap.nodes.length + (snap.kind === "group" ? 1 : 0),
    edgeCount: snap.edges.length,
    kind: snap.kind,
    local: opts.local,
    relPath: opts.relPath,
  };
}

export function mergeWorkflowListItems(items: CanvasWorkflowListItem[]): CanvasWorkflowListItem[] {
  const byId = new Map<string, CanvasWorkflowListItem>();
  for (const item of items) {
    const prev = byId.get(item.id);
    if (!prev) {
      byId.set(item.id, { ...item });
      continue;
    }
    byId.set(item.id, {
      ...prev,
      name: item.name || prev.name,
      createdAt: Math.max(prev.createdAt, item.createdAt),
      nodeCount: item.nodeCount || prev.nodeCount,
      edgeCount: item.edgeCount || prev.edgeCount,
      local: prev.local || item.local,
      relPath: prev.relPath ?? item.relPath,
    });
  }
  return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export function normalizeInsertedWorkflowNodes(nextNodes: Node<FlowNodeData>[]): {
  nodes: Node<FlowNodeData>[];
  selectedIds: string[];
} {
  const groupId = nextNodes.find((n) => n.type === "group")?.id;
  const nodes = normalizeGroupNodesForCanvas(nextNodes);
  const selectedIds = groupId ? [groupId] : nextNodes.map((n) => n.id);
  return { nodes, selectedIds };
}
