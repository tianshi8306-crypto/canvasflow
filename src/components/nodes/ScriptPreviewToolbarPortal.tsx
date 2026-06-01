import { useCallback, type MutableRefObject, type RefObject } from "react";
import { ScriptPreviewToolbar } from "@/components/nodes/ScriptPreviewToolbar";
import { NODE_CHROME_TOP_CLASS, NodePreviewChromeMeta } from "@/components/nodes/nodeChrome";
import { useNodeChromeMount } from "@/components/nodes/nodeChrome/NodeChromeContext";
import { NodeChromePortalShell } from "@/components/nodes/nodeChrome/NodeChromePortalShell";
import {
  GEN_PANEL_CHROME_ABOVE_PREVIEW_GAP,
  useNodeGenerationChrome,
} from "@/hooks/useNodeGenerationChrome";

type Props = {
  nodeId: string;
  anchorRef: RefObject<HTMLElement | null>;
  active: boolean;
  toolbarRef?: RefObject<HTMLDivElement | null>;
  label?: string;
  defaultLabel?: string;
  onCommitLabel: (label: string | undefined) => void;
  dimsText?: string | null;
  generating?: boolean;
  progress?: number | null;
};

/** 有镜头且单选：预览区上方 Portal（功能栏 → 元信息行 → 预览） */
export function ScriptPreviewToolbarPortal({
  nodeId,
  anchorRef,
  active,
  toolbarRef: externalToolbarRef,
  label,
  defaultLabel = "分镜脚本",
  onCommitLabel,
  dimsText,
  generating = false,
  progress,
}: Props) {
  const chromeMount = useNodeChromeMount();
  const { pos, panelRef: innerToolbarRef } = useNodeGenerationChrome(anchorRef, {
    active,
    mountRef: chromeMount?.mountRef,
    placement: "above",
    aboveGap: GEN_PANEL_CHROME_ABOVE_PREVIEW_GAP,
    aboveExtra: 0,
  });

  const setToolbarRef = useCallback(
    (el: HTMLDivElement | null) => {
      (innerToolbarRef as MutableRefObject<HTMLDivElement | null>).current = el;
      if (externalToolbarRef) {
        (externalToolbarRef as MutableRefObject<HTMLDivElement | null>).current = el;
      }
    },
    [innerToolbarRef, externalToolbarRef],
  );

  return (
    <NodeChromePortalShell
      active={active}
      pos={pos}
      setPanelRef={setToolbarRef}
      className={`scriptPreviewToolbarPortalRoot previewToolbarChrome--stack ${NODE_CHROME_TOP_CLASS}`}
      style={{ maxWidth: "min(600px, 92vw)" }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="nodePreviewChromeStack">
        <div className="scriptPreviewToolbarChrome">
          <ScriptPreviewToolbar nodeId={nodeId} />
        </div>
        <NodePreviewChromeMeta
          label={label}
          defaultLabel={defaultLabel}
          onCommitLabel={onCommitLabel}
          dimsText={dimsText}
          generating={generating}
          progress={progress}
        />
      </div>
    </NodeChromePortalShell>
  );
}
