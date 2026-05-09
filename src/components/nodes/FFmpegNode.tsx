import { type Node, type NodeProps } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { NodeFrame } from "@/components/nodes/NodeFrame";
import { MagneticNodeAnchors } from "@/components/nodes/MagneticNodeAnchors";
import { FFmpegConcatPanel } from "@/components/nodes/FFmpegConcatPanel";

export function FFmpegNode({ id, data, selected, type }: NodeProps<Node<FlowNodeData>>) {
  const inputs = Array.isArray(data.inputs) ? data.inputs : [];
  const splitExpanded = selected;

  const rootClass = ["ffmpegCard", splitExpanded ? "ffmpegCard--expanded" : ""].filter(Boolean).join(" ");

  return (
    <NodeFrame
      defaultTitle="视频合成"
      label={data.label}
      nodeId={id}
      selected={selected}
      tone="text"
      rootClassName={rootClass}
      upperBody={
        splitExpanded ? (
          <>
            <FFmpegConcatPanel nodeId={id} />
            <MagneticNodeAnchors nodeId={id} nodeType={type} />
          </>
        ) : undefined
      }
      floatingBottomOverlay={
        !splitExpanded ? (
          <div className="nodeFloatingBottomPanel">
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: "#64748b", fontSize: 11 }}>输入：</span>
              <span style={{ color: "#e2e8f0", fontSize: 11 }}>{inputs.length} 个片段</span>
            </div>
            <div className="mono" style={{ fontSize: 10, color: "#94a3b8", wordBreak: "break-all" }}>
              输出：{data.output?.trim() ? data.output : "未设置"}
            </div>
          </div>
        ) : undefined
      }
    >
      {!splitExpanded && <MagneticNodeAnchors nodeId={id} nodeType={type} />}
    </NodeFrame>
  );
}
