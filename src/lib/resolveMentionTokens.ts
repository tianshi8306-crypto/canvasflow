import type { Node } from "@xyflow/react";
import type { FlowNodeData } from "./types";

/**
 * Replaces @[nodeId] tokens in text with "[label: content]" from the referenced node.
 * Used at agent execution time to resolve node references in prompts.
 */
export function resolveMentionTokens(
  text: string,
  nodes: Node<FlowNodeData>[],
): string {
  return text.replace(/@\[([^\]]+)\]/g, (match, nodeId) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return match;
    const label = node.data?.label ?? nodeId;
    const content = node.data?.prompt ?? node.data?.output ?? "";
    return `[${label}: ${content.trim()}]`;
  });
}
