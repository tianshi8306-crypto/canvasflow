import type { Edge } from "@xyflow/react";
import { CANVAS_EDGE_STYLE_DEFAULT } from "@/lib/canvasColors";
import { getOutputPortType, type FlowEdgePayload } from "@/lib/flowConnectionPolicy";

/** 画布默认连线样式；`sourceNodeType` 用于写入 `data.payloadType`（M2） */
export function makeFlowEdge(source: string, target: string, sourceNodeType?: string | null): Edge {
  const payloadType = sourceNodeType ? getOutputPortType(sourceNodeType) : null;
  const base: Edge = {
    id: crypto.randomUUID(),
    source,
    target,
    sourceHandle: "out",
    targetHandle: "in",
    animated: true,
    style: { ...CANVAS_EDGE_STYLE_DEFAULT },
  };
  if (payloadType) {
    const data: FlowEdgePayload = { payloadType };
    return { ...base, data };
  }
  return base;
}
