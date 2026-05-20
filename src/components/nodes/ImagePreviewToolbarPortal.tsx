import { createPortal } from "react-dom";
import { useCallback, type MutableRefObject, type RefObject } from "react";
import { ImagePreviewToolbar } from "@/components/nodes/ImagePreviewToolbar";
import { NODE_CHROME_PANEL_CLASS, NODE_CHROME_TOP_CLASS } from "@/components/nodes/nodeChrome";
import { GEN_PANEL_CHROME_Z, useNodeGenerationChrome } from "@/hooks/useNodeGenerationChrome";

type Props = {
  nodeId: string;
  anchorRef: RefObject<HTMLElement | null>;
  active: boolean;
  hasLocalImage: boolean;
  onOpenGenPanel: () => void;
  toolbarRef?: RefObject<HTMLDivElement | null>;
};

/** 有图且选中：预览区上方外部 Portal 渲染功能栏 */
export function ImagePreviewToolbarPortal({
  nodeId,
  anchorRef,
  active,
  hasLocalImage,
  onOpenGenPanel,
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
      className={`${NODE_CHROME_PANEL_CLASS} ${NODE_CHROME_TOP_CLASS} imagePreviewToolbarChrome`}
      style={{
        position: "fixed",
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        transform: "translate(-50%, -100%)",
        zIndex: GEN_PANEL_CHROME_Z,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <ImagePreviewToolbar
        nodeId={nodeId}
        hasLocalImage={hasLocalImage}
        onOpenGenPanel={onOpenGenPanel}
      />
    </div>,
    document.body,
  );
}
