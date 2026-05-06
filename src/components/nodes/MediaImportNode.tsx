import { type Node, type NodeProps } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { NodeFrame } from "@/components/nodes/NodeFrame";
import { MagneticNodeAnchors } from "@/components/nodes/MagneticNodeAnchors";

export function MediaImportNode({ id, data, selected, type }: NodeProps<Node<FlowNodeData>>) {
  return (
    <NodeFrame
      defaultTitle="媒体导入"
      label={data.label}
      nodeId={id}
      selected={selected}
      tone="text"
      rootClassName="nodeTone-mediaImport"
    >
      <div className="mono" style={{ wordBreak: "break-all" }}>
        {data.path?.trim() ? data.path : "未选择本地文件"}
      </div>
      <MagneticNodeAnchors nodeId={id} nodeType={type} />
    </NodeFrame>
  );
}
