import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { collectIncomingImageRefs } from "@/lib/imageGeneration/collectIncomingImageRefs";

/** 连入当前节点的第一个上游图片类节点的素材引用（path / assetId 至少其一） */
export function getIncomingImageRefForNode(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  targetNodeId: string,
): { path?: string; assetId?: string } {
  const { refs } = collectIncomingImageRefs(nodes, edges, targetNodeId);
  const first = refs[0];
  if (!first) return {};
  return { path: first.path, assetId: first.assetId };
}

/** 连入当前节点的第一个带路径的 `imageNode` 的素材路径（用于图生图参考缩略图） */
export function getIncomingImagePathForNode(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  targetNodeId: string,
): string | undefined {
  return getIncomingImageRefForNode(nodes, edges, targetNodeId).path;
}
