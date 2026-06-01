import type { Node, NodeChange } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import {
  GROUP_MIN_HEIGHT,
  GROUP_MIN_WIDTH,
  getNodeWorldPosition,
  nodeWorldBounds,
  normalizeGroupNodesForCanvas,
} from "@/lib/canvasGroup";
import { groupKindLabel } from "@/lib/canvasGroupStoryboard";

function nodeById(nodes: Node<FlowNodeData>[], id: string): Node<FlowNodeData> | undefined {
  return nodes.find((n) => n.id === id);
}

export function getGroupBoxSize(group: Node<FlowNodeData>): { w: number; h: number } {
  const style = group.style ?? {};
  const wRaw = style.width ?? group.width ?? group.measured?.width ?? GROUP_MIN_WIDTH;
  const hRaw = style.height ?? group.height ?? group.measured?.height ?? GROUP_MIN_HEIGHT;
  const toNum = (v: unknown, fallback: number) => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const p = parseFloat(String(v));
    return Number.isFinite(p) ? p : fallback;
  };
  return {
    w: toNum(wRaw, GROUP_MIN_WIDTH),
    h: toNum(hRaw, GROUP_MIN_HEIGHT),
  };
}

export function getGroupWorldBounds(
  nodes: Node<FlowNodeData>[],
  groupId: string,
): { x: number; y: number; w: number; h: number } {
  const g = nodeById(nodes, groupId);
  if (!g) return { x: 0, y: 0, w: GROUP_MIN_WIDTH, h: GROUP_MIN_HEIGHT };
  const { x, y } = getNodeWorldPosition(nodes, g);
  const { w, h } = getGroupBoxSize(g);
  return { x, y, w, h };
}

export function isPointInsideGroupBounds(
  nodes: Node<FlowNodeData>[],
  groupId: string,
  cx: number,
  cy: number,
): boolean {
  const b = getGroupWorldBounds(nodes, groupId);
  return cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h;
}

function groupParentDepth(nodes: Node<FlowNodeData>[], groupId: string): number {
  let depth = 0;
  let cur = nodeById(nodes, groupId);
  while (cur?.parentId) {
    const p = nodeById(nodes, cur.parentId);
    if (!p || p.type !== "group") break;
    depth += 1;
    cur = p;
  }
  return depth;
}

function isGroupDescendantOf(
  nodes: Node<FlowNodeData>[],
  groupId: string,
  ancestorId: string,
): boolean {
  let cur = nodeById(nodes, groupId);
  while (cur?.parentId) {
    if (cur.parentId === ancestorId) return true;
    cur = nodeById(nodes, cur.parentId);
  }
  return false;
}

/** 命中点所在的最内层 group（嵌套时取最深） */
export function findInnermostGroupAtPoint(
  nodes: Node<FlowNodeData>[],
  cx: number,
  cy: number,
  excludeNodeId?: string,
): string | undefined {
  let best: { id: string; depth: number; area: number } | undefined;
  for (const n of nodes) {
    if (n.type !== "group" || n.id === excludeNodeId) continue;
    if (!isPointInsideGroupBounds(nodes, n.id, cx, cy)) continue;
    const { w, h } = getGroupBoxSize(n);
    const depth = groupParentDepth(nodes, n.id);
    const area = w * h;
    if (
      !best ||
      depth > best.depth ||
      (depth === best.depth && area < best.area)
    ) {
      best = { id: n.id, depth, area };
    }
  }
  return best?.id;
}

export function getNodeCenterWorld(
  nodes: Node<FlowNodeData>[],
  node: Node<FlowNodeData>,
): { cx: number; cy: number } {
  const { x, y, w, h } = nodeWorldBounds(nodes, node);
  return { cx: x + w / 2, cy: y + h / 2 };
}

/** 将节点挂到 newParentId（undefined = 画布顶层），保持世界坐标不变 */
export function reparentNodePreserveWorld(
  nodes: Node<FlowNodeData>[],
  nodeId: string,
  newParentId: string | undefined,
): Node<FlowNodeData>[] {
  const node = nodeById(nodes, nodeId);
  if (!node) return nodes;
  const world = getNodeWorldPosition(nodes, node);

  if (!newParentId) {
    return nodes.map((n) =>
      n.id !== nodeId
        ? n
        : {
            ...n,
            parentId: undefined,
            extent: undefined,
            position: { x: world.x, y: world.y },
          },
    );
  }

  const parent = nodeById(nodes, newParentId);
  if (!parent) return nodes;
  const parentWorld = getNodeWorldPosition(nodes, parent);
  const parentZ = parent.zIndex ?? 0;
  return nodes.map((n) =>
    n.id !== nodeId
      ? n
      : {
          ...n,
          parentId: newParentId,
          extent: undefined,
          position: {
            x: world.x - parentWorld.x,
            y: world.y - parentWorld.y,
          },
          zIndex: Math.max(n.zIndex ?? 0, parentZ + 1),
        },
  );
}

/** 脱离当前父 group，提升到外层父 group 或画布 */
export function detachOneLevelFromGroup(
  nodes: Node<FlowNodeData>[],
  nodeId: string,
): Node<FlowNodeData>[] {
  const node = nodeById(nodes, nodeId);
  if (!node?.parentId) return nodes;
  const parent = nodeById(nodes, node.parentId);
  if (parent?.type !== "group") return nodes;
  return reparentNodePreserveWorld(nodes, nodeId, parent.parentId);
}

export function reconcileNodeGroupMembership(
  nodes: Node<FlowNodeData>[],
  nodeId: string,
): { nodes: Node<FlowNodeData>[]; touchedGroupIds: Set<string> } {
  const touched = new Set<string>();
  let next = nodes;
  const initial = nodeById(next, nodeId);
  if (!initial || initial.type === "group") {
    return { nodes: next, touchedGroupIds: touched };
  }

  if (initial.parentId) touched.add(initial.parentId);

  const centerOf = (id: string) => {
    const n = nodeById(next, id);
    return n ? getNodeCenterWorld(next, n) : { cx: 0, cy: 0 };
  };

  let { cx, cy } = centerOf(nodeId);

  for (let guard = 0; guard < 8; guard += 1) {
    const node = nodeById(next, nodeId);
    if (!node?.parentId) break;
    const parent = nodeById(next, node.parentId);
    if (parent?.type !== "group") break;
    if (isPointInsideGroupBounds(next, parent.id, cx, cy)) break;
    touched.add(parent.id);
    next = detachOneLevelFromGroup(next, nodeId);
    ({ cx, cy } = centerOf(nodeId));
  }

  const current = nodeById(next, nodeId);
  if (!current) return { nodes: next, touchedGroupIds: touched };

  const targetGroupId = findInnermostGroupAtPoint(next, cx, cy, nodeId);
  if (targetGroupId) {
    if (current.parentId !== targetGroupId) {
      if (current.parentId) touched.add(current.parentId);
      touched.add(targetGroupId);
      if (!isGroupDescendantOf(next, targetGroupId, nodeId)) {
        next = reparentNodePreserveWorld(next, nodeId, targetGroupId);
      }
    }
  }

  return { nodes: next, touchedGroupIds: touched };
}

export function syncGroupLabelsForIds(
  nodes: Node<FlowNodeData>[],
  groupIds: Set<string>,
): Node<FlowNodeData>[] {
  if (groupIds.size === 0) return nodes;
  return nodes.map((n) => {
    if (n.type !== "group" || !groupIds.has(n.id)) return n;
    const memberCount = nodes.filter((m) => m.parentId === n.id).length;
    return {
      ...n,
      data: {
        ...n.data,
        label: groupKindLabel(n.data.groupKind, memberCount),
      },
    };
  });
}

/** 拖拽结束后：移入/移出组，并刷新组标题人数 */
export function applyGroupMembershipAfterDrag(
  nodes: Node<FlowNodeData>[],
  changes: NodeChange<Node<FlowNodeData>>[],
): Node<FlowNodeData>[] {
  const endedIds = new Set<string>();
  for (const c of changes) {
    if (c.type !== "position" || !("dragging" in c) || c.dragging !== false) continue;
    if (c.id) endedIds.add(c.id);
  }
  if (endedIds.size === 0) return nodes;

  let next = nodes;
  const touched = new Set<string>();
  for (const id of endedIds) {
    const result = reconcileNodeGroupMembership(next, id);
    next = result.nodes;
    for (const gid of result.touchedGroupIds) touched.add(gid);
  }
  next = syncGroupLabelsForIds(next, touched);
  return normalizeGroupNodesForCanvas(next);
}

/** 将 RF dimensions 写入 group.style，保证缩放后持久化 */
export function syncGroupStylesFromDimensions(
  nodes: Node<FlowNodeData>[],
): Node<FlowNodeData>[] {
  let anyChanged = false;
  const next = nodes.map((n) => {
    if (n.type !== "group") return n;
    const w = n.width ?? n.measured?.width;
    const h = n.height ?? n.measured?.height;
    if (w == null && h == null) return n;
    const style = {
      ...n.style,
      ...(w != null ? { width: w } : {}),
      ...(h != null ? { height: h } : {}),
    };
    if (n.style?.width === style.width && n.style?.height === style.height) return n;
    anyChanged = true;
    return { ...n, style };
  });
  return anyChanged ? next : nodes;
}
