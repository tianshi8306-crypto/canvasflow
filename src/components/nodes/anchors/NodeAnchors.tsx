import { CanvasNodeAnchors, type CanvasNodeAnchorsProps } from "./CanvasNodeAnchors";

export type NodeAnchorsVariant = "simple" | "magnetic";

export type NodeAnchorsProps = CanvasNodeAnchorsProps & {
  /** @deprecated 极简/标准已统一，保留参数兼容旧调用 */
  variant?: NodeAnchorsVariant;
};

/** 统一节点锚点（边框接线 + 外侧磁吸「+」） */
export function NodeAnchors({ nodeId, nodeType }: NodeAnchorsProps) {
  return <CanvasNodeAnchors nodeId={nodeId} nodeType={nodeType} />;
}

export { CanvasNodeAnchors } from "./CanvasNodeAnchors";
export { CanvasNodeAnchors as SimpleAnchors } from "./CanvasNodeAnchors";
export { CanvasNodeAnchors as MagneticNodeAnchors } from "./CanvasNodeAnchors";
