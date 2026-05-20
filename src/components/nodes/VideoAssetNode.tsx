import { type Node, type NodeProps } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { MinimalVideoNode } from "@/components/nodes/MinimalVideoNode";

/** 画布 videoNode：Chrome 模式（见 MinimalVideoNode） */
export function VideoAssetNode(props: NodeProps<Node<FlowNodeData>>) {
  return <MinimalVideoNode {...props} />;
}
