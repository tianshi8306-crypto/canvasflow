import { buildScriptPromptFromUpstreamText } from "@/lib/incomingScriptBinding";
import type { FlowNodeData } from "@/lib/types";
import type { Edge, Node } from "@xyflow/react";

/**
 * 将上游文本节点正文合并写入脚本节点 `prompt`（旧路径，不推荐长剧本）。
 * 推荐：剧本保留在上游文本节点，仅底栏写解析要求，由 DAG `run_script_node` 双字段解析。
 */
export function syncScriptPromptFromUpstreamText(  scriptNodeId: string,
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
): string | null {
  return buildScriptPromptFromUpstreamText(nodes, edges, scriptNodeId);
}
