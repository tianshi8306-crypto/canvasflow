import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { isEdgeDisabled } from "@/lib/edgeState";
import type { IncomingImageRef } from "@/lib/imageGeneration/types";

const IMAGE_SOURCE_TYPES = new Set(["imageNode", "imageAsset"]);
const MAX_INCOMING_IMAGE_REFS = 4;

function isImageSourceNode(type: string | undefined): boolean {
  return Boolean(type && IMAGE_SOURCE_TYPES.has(type));
}

/**
 * 采集连入目标节点的上游有效参考图（未解析 assetId）。
 * 按源节点 Y 升序；同一 source 只保留一条；最多 4 条。
 */
export function collectIncomingImageRefs(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  targetNodeId: string,
): { refs: IncomingImageRef[]; truncated: boolean } {
  const incoming = edges.filter(
    (e) =>
      !isEdgeDisabled(e) &&
      e.target === targetNodeId &&
      (!e.targetHandle || e.targetHandle === "in"),
  );

  const seen = new Set<string>();
  const items: IncomingImageRef[] = [];

  for (const e of incoming) {
    if (seen.has(e.source)) continue;
    const n = nodes.find((x) => x.id === e.source);
    if (!n || !isImageSourceNode(n.type)) continue;
    const path = n.data.path?.trim();
    const assetId = n.data.assetId?.trim();
    if (!path && !assetId) continue;
    seen.add(e.source);
    items.push({
      sourceNodeId: e.source,
      path: path || undefined,
      assetId: assetId || undefined,
      y: n.position.y,
    });
  }

  items.sort((a, b) => a.y - b.y);

  const truncated = items.length > MAX_INCOMING_IMAGE_REFS;
  if (truncated) {
    items.length = MAX_INCOMING_IMAGE_REFS;
  }

  return { refs: items, truncated };
}

export { MAX_INCOMING_IMAGE_REFS };
