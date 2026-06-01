import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { isEdgeDisabled } from "@/lib/edgeState";
import { textContentFromUpstreamNode } from "@/lib/incomingScriptBinding";
import type { IncomingImagePanelRef } from "@/lib/imageGeneration/types";
import { MAX_INCOMING_IMAGE_REFS } from "@/lib/imageGeneration/collectIncomingImageRefs";

export const MAX_INCOMING_IMAGE_TEXT_REFS = 3;

const IMAGE_SOURCE_TYPES = new Set(["imageNode", "imageAsset"]);
const TEXT_SOURCE_TYPES = new Set<Node<FlowNodeData>["type"]>(["textNode", "llm"]);

function defaultNodeLabel(type: string | undefined): string {
  if (type === "llm") return "LLM 节点";
  if (type === "textNode") return "文本节点";
  if (type === "imageNode") return "图片节点";
  if (type === "imageAsset") return "图片素材";
  return "节点";
}

/**
 * 采集连入图片节点的上游参考条项（图片 + 文本/LLM，按源节点 Y 默认排序）。
 */
export function collectIncomingImagePanelItems(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  targetNodeId: string,
): { items: IncomingImagePanelRef[]; imagesTruncated: boolean; textsTruncated: boolean } {
  const incoming = edges.filter(
    (e) =>
      !isEdgeDisabled(e) &&
      e.target === targetNodeId &&
      (!e.targetHandle || e.targetHandle === "in"),
  );

  const seen = new Set<string>();
  const items: IncomingImagePanelRef[] = [];
  let imageCount = 0;
  let textCount = 0;

  for (const e of incoming) {
    if (seen.has(e.source)) continue;
    const n = nodes.find((x) => x.id === e.source);
    if (!n?.type) continue;

    const label = n.data.label?.trim() || defaultNodeLabel(n.type);
    const base = {
      edgeId: e.id,
      sourceNodeId: e.source,
      y: n.position.y,
      nodeLabel: label,
    };

    if (IMAGE_SOURCE_TYPES.has(n.type)) {
      const path = n.data.path?.trim();
      const assetId = n.data.assetId?.trim();
      if (!path && !assetId) continue;
      seen.add(e.source);
      imageCount++;
      items.push({
        kind: "image",
        ...base,
        path: path || undefined,
        assetId: assetId || undefined,
      });
    } else if (TEXT_SOURCE_TYPES.has(n.type)) {
      const textContent = textContentFromUpstreamNode(n.data);
      if (!textContent.trim()) continue;
      seen.add(e.source);
      textCount++;
      items.push({
        kind: "text",
        ...base,
        textContent,
      });
    }
  }

  items.sort((a, b) => a.y - b.y);

  return {
    items,
    imagesTruncated: imageCount > MAX_INCOMING_IMAGE_REFS,
    textsTruncated: textCount > MAX_INCOMING_IMAGE_TEXT_REFS,
  };
}

/** 参考条展示：按 edge 顺序遍历，文本最多 3、图片最多 4（与 VGP 分类型计数一致） */
export function incomingImagePanelRefsForDisplay(
  items: IncomingImagePanelRef[],
): IncomingImagePanelRef[] {
  let imageCount = 0;
  let textCount = 0;
  const out: IncomingImagePanelRef[] = [];
  for (const it of items) {
    if (it.kind === "text") {
      if (textCount >= MAX_INCOMING_IMAGE_TEXT_REFS) continue;
      out.push(it);
      textCount++;
    } else if (it.kind === "image" && imageCount < MAX_INCOMING_IMAGE_REFS) {
      out.push(it);
      imageCount++;
    }
  }
  return out;
}

/** 有序列表中的图片项（API / resolvedRefs 用） */
export function imagePanelItemsToIncomingRefs(
  items: IncomingImagePanelRef[],
): Extract<IncomingImagePanelRef, { kind: "image" }>[] {
  return items.filter((i): i is Extract<IncomingImagePanelRef, { kind: "image" }> => i.kind === "image");
}
