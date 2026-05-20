import { isEdgeDisabled } from "@/lib/edgeState";
import type { FlowNodeData } from "@/lib/types";
import type { Edge, Node } from "@xyflow/react";

export type UpstreamImageRef = {
  nodeId: string;
  path?: string;
  assetId?: string;
};

/** 文本节点上游图片（图反推提示词） */
export function getUpstreamImageForTextNode(
  textNodeId: string,
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
): UpstreamImageRef | null {
  const sourceIds = edges
    .filter((e) => !isEdgeDisabled(e) && e.target === textNodeId)
    .map((e) => e.source);
  for (const sid of sourceIds) {
    const n = nodes.find((x) => x.id === sid);
    if (n?.type !== "imageNode") continue;
    const path = n.data.path?.trim() || undefined;
    const assetId =
      n.data.params && typeof n.data.params === "object"
        ? ((n.data.params as { assetId?: string }).assetId?.trim() || undefined)
        : undefined;
    if (path || assetId) {
      return { nodeId: n.id, path, assetId };
    }
  }
  return null;
}
