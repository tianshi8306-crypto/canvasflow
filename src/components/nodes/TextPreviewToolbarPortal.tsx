import { createPortal } from "react-dom";
import { useCallback, type MutableRefObject, type RefObject } from "react";
import {
  TextPreviewToolbar,
  type TextPreviewToolbarCallbacks,
} from "@/components/nodes/TextPreviewToolbar";
import { NODE_CHROME_TOP_CLASS } from "@/components/nodes/nodeChrome";
import { GEN_PANEL_CHROME_Z, useNodeGenerationChrome } from "@/hooks/useNodeGenerationChrome";

type Props = {
  anchorRef: RefObject<HTMLElement | null>;
  active: boolean;
  toolbarRef?: RefObject<HTMLDivElement | null>;
} & TextPreviewToolbarCallbacks;

/** 有正文且单选：节点上方 Portal 仅渲染格式条 */
export function TextPreviewToolbarPortal({
  anchorRef,
  active,
  toolbarRef: externalToolbarRef,
  ...callbacks
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
      className={`${NODE_CHROME_TOP_CLASS} textPreviewToolbarChrome`}
      style={{
        position: "fixed",
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        transform: "translate(-50%, -100%)",
        zIndex: GEN_PANEL_CHROME_Z,
        maxWidth: "min(520px, 92vw)",
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <TextPreviewToolbar {...callbacks} />
    </div>,
    document.body,
  );
}
