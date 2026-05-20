import { createPortal } from "react-dom";
import { useCallback, type MutableRefObject, type RefObject } from "react";
import { AudioTtsPanel } from "@/components/nodes/AudioTtsPanel";
import { NODE_CHROME_AUDIO_PANEL_CLASS } from "@/components/nodes/nodeChrome";
import { GEN_PANEL_CHROME_Z, useNodeGenerationChrome } from "@/hooks/useNodeGenerationChrome";

type Props = {
  nodeId: string;
  anchorRef: RefObject<HTMLElement | null>;
  active: boolean;
  /** 与音频预览壳同宽（默认与文本节点一致，300px） */
  panelWidth: number;
  panelRef?: RefObject<HTMLDivElement | null>;
  showChromeHead?: boolean;
  onRequestExpand?: () => void;
  onRequestPin?: () => void;
  onRequestUnpin?: () => void;
  onRequestClose?: () => void;
};

/** 单选展开：预览下缘 Portal 渲染 TTS 面板 */
export function AudioTtsPanelPortal({
  nodeId,
  anchorRef,
  active,
  panelWidth,
  panelRef: externalPanelRef,
  showChromeHead = true,
  onRequestExpand,
  onRequestPin,
  onRequestUnpin,
  onRequestClose,
}: Props) {
  const { pos, panelRef: innerPanelRef } = useNodeGenerationChrome(anchorRef, {
    active,
    panelWidth,
  });

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
      className={NODE_CHROME_AUDIO_PANEL_CLASS}
      style={{
        position: "fixed",
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: `${panelWidth}px`,
        maxWidth: "calc(100vw - 24px)",
        transform: "translateX(-50%)",
        zIndex: GEN_PANEL_CHROME_Z,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <AudioTtsPanel
        nodeId={nodeId}
        showChromeHead={showChromeHead}
        onRequestExpand={onRequestExpand}
        onRequestPin={onRequestPin}
        onRequestUnpin={onRequestUnpin}
        onRequestClose={onRequestClose}
      />
    </div>,
    document.body,
  );
}
