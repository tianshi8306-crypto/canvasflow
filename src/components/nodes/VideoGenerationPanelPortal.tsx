import { createPortal } from "react-dom";
import { useCallback, type MutableRefObject, type RefObject } from "react";
import { NODE_CHROME_VIDEO_PANEL_CLASS } from "@/components/nodes/nodeChrome";
import {
  GEN_PANEL_CHROME_Z,
  useNodeGenerationChrome,
} from "@/hooks/useNodeGenerationChrome";
import { VideoMultimodalInputPanel } from "@/components/nodes/VideoMultimodalInputPanel";

type Props = {
  nodeId: string;
  anchorRef: RefObject<HTMLElement | null>;
  active: boolean;
  panelRef?: RefObject<HTMLDivElement | null>;
};

/** 单选展开态：预览区下缘 Portal 渲染视频多模态生成面板 */
export function VideoGenerationPanelPortal({
  nodeId,
  anchorRef,
  active,
  panelRef: externalPanelRef,
}: Props) {
  const { pos, panelRef: innerPanelRef } = useNodeGenerationChrome(anchorRef, { active });

  const setPanelRef = useCallback(
    (el: HTMLDivElement | null) => {
      (innerPanelRef as MutableRefObject<HTMLDivElement | null>).current = el;
      if (externalPanelRef) {
        (externalPanelRef as MutableRefObject<HTMLDivElement | null>).current = el;
      }
    },
    [innerPanelRef, externalPanelRef],
  );

  if (!active || !pos || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={setPanelRef}
      className={NODE_CHROME_VIDEO_PANEL_CLASS}
      style={{
        position: "fixed",
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        transform: "translateX(-50%)",
        zIndex: GEN_PANEL_CHROME_Z + 1,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <VideoMultimodalInputPanel videoNodeId={nodeId} layout="portal" />
    </div>,
    document.body,
  );
}
