import type { Edge, Node, NodeChange } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { nodeLayoutDimensions } from "@/lib/nodeLayout";
import { enabledEdges } from "@/lib/edgeState";

export const GROUP_MIN_WIDTH = 260;
export const GROUP_MIN_HEIGHT = 220;
/** 组框内缘与成员外接矩形之间的留白（与打组时一致） */
export const GROUP_CONTENT_PADDING = 40;

function nodeById(nodes: Node<FlowNodeData>[], id: string): Node<FlowNodeData> | undefined {
  return nodes.find((n) => n.id === id);
}

/** 节点在画布上的绝对坐标（累加 parent 链） */
export function getNodeWorldPosition(
  nodes: Node<FlowNodeData>[],
  node: Node<FlowNodeData>,
): { x: number; y: number } {
  let x = node.position.x;
  let y = node.position.y;
  let cur: Node<FlowNodeData> | undefined = node;
  while (cur?.parentId) {
    const parent = nodeById(nodes, cur.parentId);
    if (!parent) break;
    x += parent.position.x;
    y += parent.position.y;
    cur = parent;
  }
  return { x, y };
}

export function nodeWorldBounds(
  nodes: Node<FlowNodeData>[],
  node: Node<FlowNodeData>,
): { x: number; y: number; w: number; h: number } {
  const { x, y } = getNodeWorldPosition(nodes, node);
  const { w, h } = nodeLayoutDimensions(node);
  return { x, y, w, h };
}

/** 选中集内去掉「父节点也被选中」的子节点，避免打组时重复嵌套 */
export function pruneSelectionToGroupingRoots(
  nodes: Node<FlowNodeData>[],
  selectedIds: string[],
): Node<FlowNodeData>[] {
  const set = new Set(selectedIds);
  return nodes.filter(
    (n) => set.has(n.id) && (!n.parentId || !set.has(n.parentId)),
  );
}

export type NestedGroupingPlan = {
  parentId: string | null;
  roots: Node<FlowNodeData>[];
  groupPosition: { x: number; y: number };
  memberPositions: Map<string, { x: number; y: number }>;
  width: number;
  height: number;
};

export function planNestedGroup(
  nodes: Node<FlowNodeData>[],
  selectedIds: string[],
): { ok: true; plan: NestedGroupingPlan } | { ok: false; message: string } {
  const roots = pruneSelectionToGroupingRoots(nodes, selectedIds);
  if (roots.length < 2) {
    return { ok: false, message: "请至少选择两个节点再打组（若已选父组，勿重复勾选其子节点）" };
  }
  const parentKeys = new Set(roots.map((r) => r.parentId ?? ""));
  if (parentKeys.size > 1) {
    return {
      ok: false,
      message: "选中的节点须在同一父级下（可在同一组内多选后再打组）",
    };
  }
  const parentId = roots[0]!.parentId ?? null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of roots) {
    const b = nodeWorldBounds(nodes, r);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  const groupWorldX = minX - GROUP_CONTENT_PADDING;
  const groupWorldY = minY - GROUP_CONTENT_PADDING;
  const parentNode = parentId ? nodeById(nodes, parentId) : undefined;
  const parentWorld = parentNode
    ? getNodeWorldPosition(nodes, parentNode)
    : { x: 0, y: 0 };
  const groupPosition = {
    x: groupWorldX - parentWorld.x,
    y: groupWorldY - parentWorld.y,
  };
  const memberPositions = new Map<string, { x: number; y: number }>();
  const relMembers: Node<FlowNodeData>[] = [];
  for (const r of roots) {
    const b = nodeWorldBounds(nodes, r);
    const rel = { x: b.x - groupWorldX, y: b.y - groupWorldY };
    memberPositions.set(r.id, rel);
    relMembers.push({ ...r, position: rel });
  }
  const { width, height } = computeGroupSizeFromMembers(relMembers);
  return {
    ok: true,
    plan: {
      parentId,
      roots,
      groupPosition,
      memberPositions,
      width,
      height,
    },
  };
}

/** 解组：子节点提升到原父组或画布顶层，保留相对坐标 */
export function ungroupNodes(nodes: Node<FlowNodeData>[], groupId: string): Node<FlowNodeData>[] {
  const group = nodeById(nodes, groupId);
  if (!group || group.type !== "group") return nodes;
  const outerParentId = group.parentId;
  return nodes
    .filter((n) => n.id !== groupId)
    .map((n) => {
      if (n.parentId !== groupId) return n;
      const nextPos = {
        x: n.position.x + group.position.x,
        y: n.position.y + group.position.y,
      };
      if (outerParentId) {
        return {
          ...n,
          parentId: outerParentId,
          extent: undefined,
          position: nextPos,
          zIndex: 1,
        };
      }
      return {
        ...n,
        parentId: undefined,
        extent: undefined,
        position: nextPos,
      };
    });
}

/** 组的所有后代节点 id（含嵌套组内的叶子，不含 group 容器） */
export function collectGroupDescendantIds(
  nodes: Node<FlowNodeData>[],
  groupId: string,
): Set<string> {
  const out = new Set<string>();
  const walk = (gid: string) => {
    for (const c of nodes.filter((n) => n.parentId === gid)) {
      if (c.type === "group") walk(c.id);
      else out.add(c.id);
    }
  };
  walk(groupId);
  return out;
}

/** 向上查找最近的 group 祖先 */
export function findAncestorGroup(
  nodes: Node<FlowNodeData>[],
  nodeId: string,
  predicate?: (g: Node<FlowNodeData>) => boolean,
): Node<FlowNodeData> | undefined {
  let cur = nodeById(nodes, nodeId);
  while (cur?.parentId) {
    const parent = nodeById(nodes, cur.parentId);
    if (!parent) break;
    if (parent.type === "group") {
      if (!predicate || predicate(parent)) return parent;
    }
    cur = parent;
  }
  return undefined;
}

export function countGroupMembers(nodes: Node<FlowNodeData>[], groupId: string): number {
  return nodes.filter((n) => n.parentId === groupId).length;
}

/** React Flow 要求父节点在数组中排在子节点之前，否则子节点无法随组一体拖动 */
export function sortNodesParentBeforeChildren<T extends Node<FlowNodeData>>(
  nodes: T[],
): T[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const depthCache = new Map<string, number>();
  const depth = (id: string, stack = new Set<string>()): number => {
    const cached = depthCache.get(id);
    if (cached != null) return cached;
    if (stack.has(id)) return 0;
    stack.add(id);
    const n = byId.get(id);
    if (!n?.parentId || !byId.has(n.parentId)) {
      depthCache.set(id, 0);
      return 0;
    }
    const d = 1 + depth(n.parentId, stack);
    depthCache.set(id, d);
    return d;
  };
  return [...nodes]
    .map((n, index) => ({ n, index, depth: depth(n.id) }))
    .sort((a, b) => a.depth - b.depth || a.index - b.index)
    .map(({ n }) => n);
}

export const GROUP_NODE_DRAG_HANDLE = ".groupNode__dragHandle";

/** 打组 / 加载时补齐 group 节点拖拽与层级字段 */
export function normalizeGroupNodesForCanvas<T extends Node<FlowNodeData>>(
  nodes: T[],
): T[] {
  const sorted = sortNodesParentBeforeChildren(nodes);
  const byId = new Map(sorted.map((n) => [n.id, n]));
  return sorted.map((n) => {
    const parent = n.parentId ? byId.get(n.parentId) : undefined;
    if (parent?.type === "group" && n.type !== "group" && n.extent) {
      const { extent: _e, ...rest } = n;
      n = rest as T;
    }
    if (n.type !== "group") return n;
    const parentZ =
      n.parentId && byId.has(n.parentId)
        ? (byId.get(n.parentId)?.zIndex ?? 0)
        : -1;
    return {
      ...n,
      draggable: n.draggable !== false,
      dragHandle: GROUP_NODE_DRAG_HANDLE,
      zIndex: n.zIndex ?? parentZ + 1,
      selectable: n.selectable !== false,
    } as T;
  });
}

export function hasGroupInSelection(
  nodes: Node<FlowNodeData>[],
  selectedNodeIds: string[],
): boolean {
  return selectedNodeIds.some((id) => nodes.find((n) => n.id === id)?.type === "group");
}

export function isSingleGroupSelection(
  nodes: Node<FlowNodeData>[],
  selectedNodeIds: string[],
): boolean {
  return (
    selectedNodeIds.length === 1 &&
    nodes.find((n) => n.id === selectedNodeIds[0])?.type === "group"
  );
}

export function groupBoundsNodeIds(
  nodes: Node<FlowNodeData>[],
  groupId: string,
): string[] {
  const memberIds = nodes.filter((n) => n.parentId === groupId).map((n) => n.id);
  return [groupId, ...memberIds];
}

/** 根据组内成员相对坐标计算组框 style 宽高（含最小尺寸与内边距） */
export function computeGroupSizeFromMembers(
  members: Node<FlowNodeData>[],
): { width: number; height: number } {
  if (members.length === 0) {
    return { width: GROUP_MIN_WIDTH, height: GROUP_MIN_HEIGHT };
  }
  let maxRight = 0;
  let maxBottom = 0;
  for (const m of members) {
    const { w, h } = nodeLayoutDimensions(m);
    maxRight = Math.max(maxRight, m.position.x + w);
    maxBottom = Math.max(maxBottom, m.position.y + h);
  }
  return {
    width: Math.max(GROUP_MIN_WIDTH, maxRight + GROUP_CONTENT_PADDING),
    height: Math.max(GROUP_MIN_HEIGHT, maxBottom + GROUP_CONTENT_PADDING),
  };
}

/** 限制 group 的 dimensions 变更不小于成员外接矩形 */
export function clampGroupDimensionChanges(
  changes: NodeChange<Node<FlowNodeData>>[],
  nodes: Node<FlowNodeData>[],
): NodeChange<Node<FlowNodeData>>[] {
  return changes.map((change) => {
    if (change.type !== "dimensions" || !change.dimensions) return change;
    const node = nodes.find((n) => n.id === change.id);
    if (node?.type !== "group") return change;
    const members = nodes.filter((n) => n.parentId === change.id);
    const min = computeGroupSizeFromMembers(members);
    const w = change.dimensions.width;
    const h = change.dimensions.height;
    if (w == null && h == null) return change;
    return {
      ...change,
      dimensions: {
        width: w != null ? Math.max(w, min.width) : w,
        height: h != null ? Math.max(h, min.height) : h,
      },
    };
  });
}

const GROUP_EXECUTABLE_TYPES = new Set([
  "llm",
  "textNode",
  "scriptNode",
  "imageNode",
  "videoNode",
  "audioNode",
  "mediaImport",
  "imageAsset",
  "ffmpegConcat",
]);

const GROUP_MEDIA_TYPES = new Set([
  "imageNode",
  "videoNode",
  "audioNode",
  "mediaImport",
  "imageAsset",
  "ffmpegConcat",
]);

export type GroupExecutionSubgraph = {
  memberNodes: Node<FlowNodeData>[];
  memberEdges: Edge[];
  entryNodeIds: string[];
};

/** 组内可执行节点（含嵌套子组内的节点，不含 group 容器） */
export function collectGroupExecutableNodes(
  nodes: Node<FlowNodeData>[],
  groupId: string,
): Node<FlowNodeData>[] {
  const descendantIds = collectGroupDescendantIds(nodes, groupId);
  return nodes.filter(
    (n) => descendantIds.has(n.id) && GROUP_EXECUTABLE_TYPES.has(n.type ?? ""),
  );
}

/** 组内可执行子图（含嵌套组后代，不含 group 容器本身） */
export function buildGroupExecutionSubgraph(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  groupId: string,
): GroupExecutionSubgraph {
  const memberNodes = collectGroupExecutableNodes(nodes, groupId);
  const memberIds = new Set(memberNodes.map((n) => n.id));
  const memberEdges = enabledEdges(
    edges.filter((e) => memberIds.has(e.source) && memberIds.has(e.target)),
  );
  const entryNodeIds = findGroupEntryNodeIds(memberIds, memberEdges);
  return { memberNodes, memberEdges, entryNodeIds };
}

export function findGroupEntryNodeIds(memberIds: Set<string>, edges: Edge[]): string[] {
  const internalTargets = new Set(
    edges.filter((e) => memberIds.has(e.source) && memberIds.has(e.target)).map((e) => e.target),
  );
  const entries = [...memberIds].filter((id) => !internalTargets.has(id));
  return entries;
}

/** 无入边时（环或全互连）取稳定排序后的首个成员作为入口 */
export function fallbackGroupEntryNodeId(memberNodes: Node<FlowNodeData>[]): string | null {
  if (memberNodes.length === 0) return null;
  const sorted = [...memberNodes].sort(
    (a, b) => a.position.y - b.position.y || a.position.x - b.position.x || a.id.localeCompare(b.id),
  );
  return sorted[0]!.id;
}

/** 收集组内媒体节点的工程相对 path（去重，含嵌套子组） */
export function collectGroupMediaRelPaths(
  nodes: Node<FlowNodeData>[],
  groupId: string,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const descendantIds = collectGroupDescendantIds(nodes, groupId);
  for (const n of nodes) {
    if (!descendantIds.has(n.id) || !GROUP_MEDIA_TYPES.has(n.type ?? "")) continue;
    const p = n.data.path?.trim();
    if (!p || seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

export function groupDisplayLabel(group: Node<FlowNodeData> | undefined, memberCount: number): string {
  if (memberCount > 0) return `分组 · ${memberCount} 个节点`;
  return group?.data.label?.trim() || "分组";
}

export function selectionIdsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** 策略 A：单击组内子节点时提升为选中父 group */
export function resolveGroupSelectionIds(
  nodes: Node<FlowNodeData>[],
  ids: string[],
): string[] {
  if (ids.length !== 1) return ids;
  const hit = nodes.find((n) => n.id === ids[0]);
  if (!hit?.parentId) return ids;
  const parent = nodes.find((n) => n.id === hit.parentId);
  if (parent?.type === "group") return [parent.id];
  return ids;
}
