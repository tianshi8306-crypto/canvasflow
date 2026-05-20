import { Position, type Node } from "@xyflow/react";
import { getSimpleAnchorFlowPosition } from "@/lib/simpleAnchorGeometry";
import { nodeLayoutDimensions } from "@/lib/nodeLayout";

/** 估算节点上 in/out 锚点的画布坐标（与 CSS 锚点偏移一致） */
export function getAnchorHandleFlowPosition(
  node: Node,
  handleType: "source" | "target",
): { x: number; y: number; position: Position } {
  if (node.type === "imageNode") {
    return getSimpleAnchorFlowPosition(node, handleType);
  }
  const { w, h } = nodeLayoutDimensions(node);
  const cy = node.position.y + h / 2;
  if (handleType === "source") {
    return { x: node.position.x + w, y: cy, position: Position.Right };
  }
  return { x: node.position.x, y: cy, position: Position.Left };
}
