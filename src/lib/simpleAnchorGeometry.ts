import { Position, type Node } from "@xyflow/react";
import { nodeLayoutDimensions } from "@/lib/nodeLayout";

/** 极简锚点圆钮直径（与 CSS --simple-anchor-knob 一致） */
export const SIMPLE_ANCHOR_KNOB = 18;

/** 锚点圆钮与预览面板（节点外缘）之间的间距 */
export const SIMPLE_ANCHOR_EDGE_GAP = 6;

/** 指针进入该半径（px）时，锚点磁吸到鼠标位置 */
export const SIMPLE_ANCHOR_MAGNET_RADIUS = 44;

/** 水平中心对齐吸附阈值（拖拽节点） */
export const SIMPLE_ANCHOR_ALIGN_SNAP_PX = 28;

const KNOB_R = SIMPLE_ANCHOR_KNOB / 2;

/** 热区内锚点默认位置（knob-wrap 的 left/top，非圆心） */
export function getSimpleAnchorRestingKnobPos(
  zoneWidth: number,
  zoneHeight: number,
  side: "left" | "right",
): { left: number; top: number } {
  return {
    top: zoneHeight / 2 - KNOB_R,
    // 左：圆心距节点左缘 gap+r；右：圆心距节点右缘 gap+r（wrap 左上角对称）
    left: side === "left" ? zoneWidth - SIMPLE_ANCHOR_KNOB : 0,
  };
}

export function getSimpleAnchorCenterOffsetX(
  side: "left" | "right",
  nodeWidth: number,
): number {
  if (side === "left") {
    return -(SIMPLE_ANCHOR_EDGE_GAP + KNOB_R);
  }
  return nodeWidth + SIMPLE_ANCHOR_EDGE_GAP + KNOB_R;
}

/** 节点锚点在画布 flow 坐标系下的中心点 */
export function getSimpleAnchorFlowPosition(
  node: Node,
  handleType: "source" | "target",
): { x: number; y: number; position: Position } {
  const { w, h } = nodeLayoutDimensions(node);
  const cy = node.position.y + h / 2;
  if (handleType === "source") {
    return {
      x: node.position.x + getSimpleAnchorCenterOffsetX("right", w),
      y: cy,
      position: Position.Right,
    };
  }
  return {
    x: node.position.x + getSimpleAnchorCenterOffsetX("left", w),
    y: cy,
    position: Position.Left,
  };
}
