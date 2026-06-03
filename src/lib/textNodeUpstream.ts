import { isEdgeDisabled } from "@/lib/edgeState";
import {
  incomingTextUpstreamState,
  orderedIncomingTextNodeIds,
  textContentFromUpstreamNode,
  type IncomingScriptUpstreamState,
} from "@/lib/incomingScriptBinding";
import type { FlowNodeData } from "@/lib/types";
import type { Edge, Node } from "@xyflow/react";

export type UpstreamImageRef = {
  nodeId: string;
  path?: string;
  assetId?: string;
};

export type TextNodeUpstreamTextSource = {
  nodeId: string;
  label: string;
  charCount: number;
};

const TEXT_UPSTREAM_TYPES = new Set<Node<FlowNodeData>["type"]>(["textNode", "llm"]);

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

/** 已连接且启用的上游文本节点（textNode / llm） */
export function listTextNodeUpstreamTextSources(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  textNodeId: string,
): TextNodeUpstreamTextSource[] {
  if (incomingTextUpstreamState(nodes, edges, textNodeId) !== "enabled") return [];

  const ids = orderedIncomingTextNodeIds(nodes, edges, textNodeId);
  const out: TextNodeUpstreamTextSource[] = [];
  for (const id of ids) {
    const n = nodes.find((x) => x.id === id);
    if (!n?.type || !TEXT_UPSTREAM_TYPES.has(n.type)) continue;
    const content = textContentFromUpstreamNode(n.data);
    if (!content) continue;
    out.push({
      nodeId: id,
      label: n.data.label?.trim() || (n.type === "llm" ? "LLM 节点" : "文本节点"),
      charCount: content.length,
    });
  }
  return out;
}

export function textNodeUpstreamTextState(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  textNodeId: string,
): IncomingScriptUpstreamState {
  return incomingTextUpstreamState(nodes, edges, textNodeId);
}
