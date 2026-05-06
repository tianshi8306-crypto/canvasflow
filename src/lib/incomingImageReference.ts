import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { isEdgeDisabled } from "@/lib/edgeState";

/** 连入当前节点的第一个 `imageNode` 的素材引用（path / assetId 至少其一） */
export function getIncomingImageRefForNode(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  targetNodeId: string,
): { path?: string; assetId?: string } {
  const incoming = edges.filter(
    (e) =>
      !isEdgeDisabled(e) &&
      e.target === targetNodeId &&
      (!e.targetHandle || e.targetHandle === "in"),
  );
  for (const e of incoming) {
    const n = nodes.find((x) => x.id === e.source);
    if (n?.type !== "imageNode") continue;
    const p = n.data.path?.trim();
    const aid = n.data.assetId?.trim();
    if (p || aid) return { path: p, assetId: aid };
  }
  return {};
}

/** 连入当前节点的第一个带路径的 `imageNode` 的素材路径（用于图生图参考缩略图） */
export function getIncomingImagePathForNode(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  targetNodeId: string,
): string | undefined {
  return getIncomingImageRefForNode(nodes, edges, targetNodeId).path;
}
