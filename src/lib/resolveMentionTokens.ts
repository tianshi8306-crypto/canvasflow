import type { Node } from "@xyflow/react";
import type { FlowNodeData } from "./types";
import { resolveMentionNodeTokens as resolveMentionNodeTokensImpl } from "./promptUpstreamTextRefs";

/**
 * Replaces @[nodeId] tokens in text with "[label: content]" from the referenced node.
 * Used at agent execution time to resolve node references in prompts.
 */
export function resolveMentionTokens(
  text: string,
  nodes: Node<FlowNodeData>[],
): string {
  return resolveMentionNodeTokensImpl(text, nodes);
}
