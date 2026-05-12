import { useMemo } from "react";
import { type Node, type NodeProps } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { NodeFrame } from "@/components/nodes/NodeFrame";
import { MagneticNodeAnchors } from "@/components/nodes/MagneticNodeAnchors";
import { LLMPanel } from "@/components/nodes/LLMPanel";

type LLMParams = {
  prompt?: string;
  modelInput?: string;
  providerId?: string;
  model?: string;
};

function getLLMParams(data: FlowNodeData): LLMParams {
  const p = data.params;
  if (!p || typeof p !== "object") return {};
  return p as LLMParams;
}

function LLMTitleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 9.5h8M8 12.5h6M8 15.5h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function LLMDocGlyph() {
  return (
    <div className="llmNodeDocGlyph" aria-hidden>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.3" />
        <path d="M8 9.5h8M8 12.5h6M8 15.5h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function LLMNode({ id, data, selected, type }: NodeProps<Node<FlowNodeData>>) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const params = useMemo(() => getLLMParams(data), [data.params]);

  const hasPrompt = Boolean(params.prompt?.trim());
  const splitExpanded = Boolean(selected);

  return (
    <NodeFrame
      defaultTitle="LLM"
      label={data.label}
      nodeId={id}
      selected={selected}
      tone="llm"
      icon={<LLMTitleIcon />}
      rootClassName="llmNodeCard"
      subtitle={splitExpanded ? undefined : hasPrompt ? params.prompt!.slice(0, 44) : "输入提示词，生成内容"}
      expandedSplit={splitExpanded}
      upperBody={
        splitExpanded ? (
          <>
            <LLMDocGlyph />
            <MagneticNodeAnchors nodeId={id} nodeType={type} />
          </>
        ) : undefined
      }
      floatingBottomOverlay={
        selected ? (
          <div className="nodeFloatingBottomPanel">
            <LLMPanel
              nodeId={id}
              prompt={params.prompt}
              modelInput={params.modelInput}
              providerId={params.providerId}
            />
          </div>
        ) : (
          <div style={{ display: "none" }} aria-hidden />
        )
      }
      lowerBody={undefined}
    >
      {!splitExpanded ? (
        <>
          <LLMDocGlyph />
          <MagneticNodeAnchors nodeId={id} nodeType={type} />
        </>
      ) : null}
    </NodeFrame>
  );
}
