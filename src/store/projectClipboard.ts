import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";

let copiedNodes: Node<FlowNodeData>[] = [];
let copiedEdges: Edge[] = [];

export function setFlowClipboard(nodes: Node<FlowNodeData>[], edges: Edge[]) {
  copiedNodes = nodes;
  copiedEdges = edges;
}

export function getFlowClipboardCount() {
  return copiedNodes.length;
}

export function getFlowClipboard() {
  return { nodes: copiedNodes, edges: copiedEdges };
}
