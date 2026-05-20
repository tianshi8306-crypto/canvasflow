import { buildTextPromptFromScriptBinding } from "@/lib/incomingScriptBinding";
import type { FlowNodeData } from "@/lib/types";
import type { Edge, Node } from "@xyflow/react";

/** 将上游脚本节点正文写入文本节点 prompt（容器态下的轻量同步，无底栏） */
export function syncTextPromptFromUpstreamScript(
  textNodeId: string,
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
): string | null {
  return buildTextPromptFromScriptBinding(nodes, edges, textNodeId);
}
