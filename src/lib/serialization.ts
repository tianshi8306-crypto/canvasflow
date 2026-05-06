import type { Edge, Node, Viewport } from "@xyflow/react";
import { sanitizeCanvasEdges } from "@/lib/flowConnectionPolicy";
import type { CanvasFileV1, FlowNodeData } from "./types";

export const defaultViewport: Viewport = { x: 0, y: 0, zoom: 1 };

export function serializeCanvas(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  viewport: Viewport,
): string {
  const payload: CanvasFileV1 = {
    version: 1,
    viewport,
    nodes,
    edges,
  };
  return JSON.stringify(payload, null, 2);
}

export function parseCanvas(raw: string): {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  viewport: Viewport;
  /** M2：从磁盘读入时剔除的不兼容连线数量 */
  invalidEdgesDropped: number;
} {
  const data = JSON.parse(raw) as CanvasFileV1;
  const nodes = (data.nodes ?? []) as Node<FlowNodeData>[];
  const rawEdges = data.edges ?? [];
  const { edges, droppedCount } = sanitizeCanvasEdges(nodes, rawEdges);
  return {
    nodes,
    edges,
    viewport: data.viewport ?? defaultViewport,
    invalidEdgesDropped: droppedCount,
  };
}
