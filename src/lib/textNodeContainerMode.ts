import { isEdgeDisabled } from "@/lib/edgeState";
import type { FlowNodeData } from "@/lib/types";
import type { Edge, Node } from "@xyflow/react";

/** 文本作为「源」连出时，下游消费 prompt，文本节点仅展示/编辑正文 */
const TEXT_OUTGOING_PARTNER_TYPES = new Set([
  "videoNode",
  "audioNode",
  "scriptNode",
  "imageNode",
  "imageAsset",
]);

/** 文本作为「汇」接入时，上游写入或驱动反推结果，文本节点仅展示/编辑正文 */
const TEXT_INCOMING_PARTNER_TYPES = new Set([
  "imageNode",
  "imageAsset",
  "videoNode",
  "scriptNode",
]);

function hasLinkedPartner(
  edges: Edge[],
  nodes: Node<FlowNodeData>[],
  textNodeId: string,
  direction: "incoming" | "outgoing",
  partnerTypes: Set<string>,
): boolean {
  const candidateIds =
    direction === "outgoing"
      ? edges
          .filter((e) => !isEdgeDisabled(e) && e.source === textNodeId)
          .map((e) => e.target)
      : edges
          .filter((e) => !isEdgeDisabled(e) && e.target === textNodeId)
          .map((e) => e.source);

  return candidateIds.some((id) => {
    const t = nodes.find((n) => n.id === id)?.type;
    return t != null && partnerTypes.has(t);
  });
}

/**
 * 工作流中的被动文本容器：已与媒体/脚本节点连线传递内容。
 * 此模式下不在文本节点下展示 Composer、VGP、脚本同步条等「参数生成面板」。
 */
export const TEXT_PASSIVE_CONTAINER_STATUS =
  "文本节点已接入工作流：请在此编辑/查看正文；生成与反推请在关联的图片/视频/音频/脚本节点操作";

export function isPassiveTextContainer(
  textNodeId: string,
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
): boolean {
  return (
    hasLinkedPartner(edges, nodes, textNodeId, "outgoing", TEXT_OUTGOING_PARTNER_TYPES) ||
    hasLinkedPartner(edges, nodes, textNodeId, "incoming", TEXT_INCOMING_PARTNER_TYPES)
  );
}
