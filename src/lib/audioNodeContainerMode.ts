import { isEdgeDisabled } from "@/lib/edgeState";
import type { FlowNodeData } from "@/lib/types";
import type { Edge, Node } from "@xyflow/react";

function hasAssetOnNode(node: Node<FlowNodeData> | undefined): boolean {
  if (!node) return false;
  return Boolean(node.data.path?.trim() || node.data.assetId?.trim());
}

function findLinkedPartnerId(
  edges: Edge[],
  nodes: Node<FlowNodeData>[],
  audioNodeId: string,
  direction: "incoming" | "outgoing",
  partnerType: string,
): string | undefined {
  const candidateIds =
    direction === "outgoing"
      ? edges
          .filter((e) => !isEdgeDisabled(e) && e.source === audioNodeId)
          .map((e) => e.target)
      : edges
          .filter((e) => !isEdgeDisabled(e) && e.target === audioNodeId)
          .map((e) => e.source);

  for (const id of candidateIds) {
    const t = nodes.find((n) => n.id === id)?.type;
    if (t === partnerType) return id;
  }
  return undefined;
}

/**
 * 已作为视频声音参考：连出到 videoNode 且自身已有素材。
 * 默认收起 ATP，顶栏引导去视频节点生成。
 */
export const AUDIO_PASSIVE_REFERENCE_STATUS =
  "音频已作为视频声音参考：请在视频节点底栏生成；如需改 TTS 可钉住或展开文字转语音面板";

export function isPassiveAudioAsset(
  audioNodeId: string,
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
): boolean {
  const self = nodes.find((n) => n.id === audioNodeId);
  if (!hasAssetOnNode(self)) return false;
  return Boolean(findLinkedPartnerId(edges, nodes, audioNodeId, "outgoing", "videoNode"));
}

export function findOutgoingVideoNodeId(
  audioNodeId: string,
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
): string | undefined {
  return findLinkedPartnerId(edges, nodes, audioNodeId, "outgoing", "videoNode");
}

export function findIncomingTextNodeId(
  audioNodeId: string,
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
): string | undefined {
  return findLinkedPartnerId(edges, nodes, audioNodeId, "incoming", "textNode");
}
