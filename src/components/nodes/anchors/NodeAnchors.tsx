import { SimpleAnchors } from "@/components/nodes/anchors/SimpleAnchors";
import { MagneticNodeAnchors } from "@/components/nodes/MagneticNodeAnchors";

export type NodeAnchorsVariant = "simple" | "magnetic";

export type NodeAnchorsProps = {
  nodeId: string;
  nodeType: string | undefined;
  /** simple：极简图片节点；magnetic：标准节点（悬停显隐 + 完整菜单） */
  variant?: NodeAnchorsVariant;
};

/**
 * 统一节点锚点入口：按节点形态选择 Simple / Magnetic 实现。
 */
export function NodeAnchors({ nodeId, nodeType, variant = "magnetic" }: NodeAnchorsProps) {
  if (variant === "simple") {
    return <SimpleAnchors nodeId={nodeId} nodeType={nodeType} />;
  }
  return <MagneticNodeAnchors nodeId={nodeId} nodeType={nodeType} />;
}

export { SimpleAnchors } from "./SimpleAnchors";
export { MagneticNodeAnchors } from "../MagneticNodeAnchors";
