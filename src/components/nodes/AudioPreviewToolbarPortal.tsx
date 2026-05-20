import { createPortal } from "react-dom";
import { useCallback, type MutableRefObject, type RefObject } from "react";
import { AudioPreviewToolbar } from "@/components/nodes/AudioPreviewToolbar";
import { NODE_CHROME_PANEL_CLASS, NODE_CHROME_TOP_CLASS } from "@/components/nodes/nodeChrome";
import { GEN_PANEL_CHROME_Z, useNodeGenerationChrome } from "@/hooks/useNodeGenerationChrome";

type Props = {
  nodeId: string;
  anchorRef: RefObject<HTMLElement | null>;
  active: boolean;
  hasLocalAudio: boolean;
  onOpenAtp: () => void;
  toolbarRef?: RefObject<HTMLDivElement | null>;
};

/** 有音频且单选：预览区上方 Portal 工具条 */
export function AudioPreviewToolbarPortal({
  nodeId,
  anchorRef,
  active,
  hasLocalAudio,
  onOpenAtp,
  toolbarRef: externalToolbarRef,
}: Props) {
  const { pos, panelRef: innerToolbarRef } = useNodeGenerationChrome(anchorRef, {
    active,
    placement: "above",
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

  if (!active || !pos || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={setToolbarRef}
      className={`${NODE_CHROME_PANEL_CLASS} ${NODE_CHROME_TOP_CLASS} audioPreviewToolbarChrome`}
      style={{
        position: "fixed",
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        transform: "translate(-50%, -100%)",
        zIndex: GEN_PANEL_CHROME_Z,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <AudioPreviewToolbar nodeId={nodeId} hasLocalAudio={hasLocalAudio} onOpenAtp={onOpenAtp} />
    </div>,
    document.body,
  );
}
