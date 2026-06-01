import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";

/** 序列化为 Rust `CanvasGraph` 结构 */
export function serializeCanvasGraphForHermes(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
): { nodes: Array<{ id: string; type: string; data: FlowNodeData }>; edges: Edge[] } {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type ?? "default",
      data: n.data,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      targetHandle: e.targetHandle ?? undefined,
    })),
  };
}
