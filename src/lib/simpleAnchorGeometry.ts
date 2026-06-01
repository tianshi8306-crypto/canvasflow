import { Position, type Node } from "@xyflow/react";
import { nodeLayoutDimensions } from "@/lib/nodeLayout";

/** 极简锚点圆钮直径（与 CSS --simple-anchor-knob 一致） */
export const SIMPLE_ANCHOR_KNOB = 18;

/** 交互圆钮相对节点边框的外移距离（仅视觉/命中，连线落点在边框） */
export const SIMPLE_ANCHOR_VISUAL_OUTSET = 6;

/** @deprecated 连线已贴边框，保留别名避免旧引用报错 */
export const SIMPLE_ANCHOR_EDGE_GAP = SIMPLE_ANCHOR_VISUAL_OUTSET;

/** 指针进入该半径（px）时，锚点磁吸到鼠标位置 */
export const SIMPLE_ANCHOR_MAGNET_RADIUS = 44;

/** 水平中心对齐吸附阈值（拖拽节点） */
export const SIMPLE_ANCHOR_ALIGN_SNAP_PX = 28;

/** 热区内交互圆钮默认位置（居中于外侧热区，不贴节点边框） */
export function getSimpleAnchorRestingKnobPos(
  zoneWidth: number,
  zoneHeight: number,
  _side: "left" | "right",
): { left: number; top: number } {
  return {
    left: (zoneWidth - SIMPLE_ANCHOR_KNOB) / 2,
    top: (zoneHeight - SIMPLE_ANCHOR_KNOB) / 2,
  };
}

/** 连线锚点圆心相对节点左上角的 X（贴左右边框） */
export function getSimpleAnchorCenterOffsetX(
  side: "left" | "right",
  nodeWidth: number,
): number {
  return side === "left" ? 0 : nodeWidth;
}

/** 节点锚点在画布 flow 坐标系下的中心点（连线贴边框） */
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
