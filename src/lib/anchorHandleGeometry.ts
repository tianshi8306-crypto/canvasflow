import { Position, type Node } from "@xyflow/react";
import { getSimpleAnchorFlowPosition } from "@/lib/simpleAnchorGeometry";

/** 节点 in/out 锚点在画布上的坐标（与边框接线 Handle 一致） */
export function getAnchorHandleFlowPosition(
  node: Node,
  handleType: "source" | "target",
): { x: number; y: number; position: Position } {
  return getSimpleAnchorFlowPosition(node, handleType);
}
