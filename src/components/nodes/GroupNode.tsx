import { type Node, type NodeProps } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { NodeRunBadge } from "@/components/nodes/NodeRunBadge";

/** 打组后的父容器节点（子节点通过 parentId + extent 嵌套） */
export function GroupNode({ id, data }: NodeProps<Node<FlowNodeData>>) {
  return (
    <div
      className="groupNodeChrome"
      style={{
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        pointerEvents: "none",
      }}
    >
      <div className="groupNodeTitle" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span>{data.label ?? "工作流分组"}</span>
        <span style={{ pointerEvents: "auto" }}>
          <NodeRunBadge nodeId={id} />
        </span>
      </div>
    </div>
  );
}
