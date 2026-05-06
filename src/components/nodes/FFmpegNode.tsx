import { type Node, type NodeProps } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { NodeFrame } from "@/components/nodes/NodeFrame";
import { MagneticNodeAnchors } from "@/components/nodes/MagneticNodeAnchors";

export function FFmpegNode({ id, data, selected, type }: NodeProps<Node<FlowNodeData>>) {
  const inputs = Array.isArray(data.inputs) ? data.inputs : [];
  return (
    <NodeFrame
      defaultTitle="视频合成"
      label={data.label}
      nodeId={id}
      selected={selected}
      tone="text"
      rootClassName="nodeTone-ffmpeg"
    >
      <div style={{ marginBottom: 8 }}>输入：{inputs.length} 个</div>
      <div className="mono" style={{ wordBreak: "break-all" }}>
        输出：{data.output?.trim() ? data.output : "未设置"}
      </div>
      <MagneticNodeAnchors nodeId={id} nodeType={type} />
    </NodeFrame>
  );
}
