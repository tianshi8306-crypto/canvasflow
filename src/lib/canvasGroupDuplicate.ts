import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { cloneFlowNodeData } from "@/lib/flowNodeDataClone";
import {
  buildPasteEdgesFromClipboard,
  buildPasteNodesFromClipboard,
} from "@/lib/buildPasteNodesFromClipboard";

/** 整组副本相对原位置的默认偏移（世界坐标下根组节点位移） */
export const GROUP_DUPLICATE_OFFSET = 48;

/** 收集 group 及其全部嵌套子节点 id */
export function collectGroupSubtreeIds(
  nodes: Node<FlowNodeData>[],
  groupId: string,
): Set<string> {
  const ids = new Set<string>([groupId]);
  const queue = [groupId];
  while (queue.length > 0) {
    const pid = queue.shift()!;
    for (const child of nodes.filter((n) => n.parentId === pid)) {
      ids.add(child.id);
      if (child.type === "group") queue.push(child.id);
    }
  }
  return ids;
}

/** 子树内连线（两端均在子树内，含嵌套组之间） */
export function collectGroupInternalEdges(
  edges: Edge[],
  subtreeIds: ReadonlySet<string>,
): Edge[] {
  return edges.filter((e) => subtreeIds.has(e.source) && subtreeIds.has(e.target));
}

export function buildGroupDuplicatePaste(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  groupId: string,
  offset = GROUP_DUPLICATE_OFFSET,
): { nextNodes: Node<FlowNodeData>[]; nextEdges: Edge[]; idMap: Map<string, string> } | null {
  const group = nodes.find((n) => n.id === groupId && n.type === "group");
  if (!group) return null;

  const subtreeIds = collectGroupSubtreeIds(nodes, groupId);
  const copiedNodes = nodes
    .filter((n) => subtreeIds.has(n.id))
    .map((n) => ({ ...n, data: cloneFlowNodeData(n.data) }));
  const copiedEdges = collectGroupInternalEdges(edges, subtreeIds).map(
    (e) => JSON.parse(JSON.stringify(e)) as Edge,
  );

  const { nextNodes, idMap } = buildPasteNodesFromClipboard(
    { copiedNodes, copiedEdges },
    offset,
  );
  const nextEdges = buildPasteEdgesFromClipboard(copiedEdges, idMap, nextNodes);
  return { nextNodes, nextEdges, idMap };
}
