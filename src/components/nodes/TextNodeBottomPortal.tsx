import { createPortal } from "react-dom";
import { useCallback, type MutableRefObject, type ReactNode, type RefObject } from "react";
import { NODE_CHROME_TEXT_PANEL_CLASS } from "@/components/nodes/nodeChrome";
import {
  GEN_PANEL_CHROME_Z,
  useNodeGenerationChrome,
} from "@/hooks/useNodeGenerationChrome";

type Props = {
  anchorRef: RefObject<HTMLElement | null>;
  active: boolean;
  /** 与预览壳同宽（默认 300px），勿用图片节点 500px */
  panelWidth: number;
  panelRef?: RefObject<HTMLDivElement | null>;
  children: ReactNode;
};

/** 文本节点底栏：Portal 到 body，锚在预览壳下缘（对齐图片生成面板） */
export function TextNodeBottomPortal({
  anchorRef,
  active,
  panelWidth,
  panelRef: externalPanelRef,
  children,
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
      className={NODE_CHROME_TEXT_PANEL_CLASS}
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
      {children}
    </div>,
    document.body,
  );
}
