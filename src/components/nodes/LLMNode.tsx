import { type Node, type NodeProps } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { NodeFrame } from "@/components/nodes/NodeFrame";
import { MagneticNodeAnchors } from "@/components/nodes/MagneticNodeAnchors";

export function LLMNode({ id, data, selected, type }: NodeProps<Node<FlowNodeData>>) {
  return (
    <NodeFrame
      defaultTitle="LLM"
      label={data.label}
      nodeId={id}
      selected={selected}
      tone="text"
      rootClassName="nodeTone-llm"
    >
      <div className="mono" style={{ whiteSpace: "pre-wrap", color: "var(--muted)" }}>
        {(data.prompt ?? "").slice(0, 220)}
        {(data.prompt?.length ?? 0) > 220 ? "…" : ""}
      </div>
      <MagneticNodeAnchors nodeId={id} nodeType={type} />
    </NodeFrame>
  );
}
