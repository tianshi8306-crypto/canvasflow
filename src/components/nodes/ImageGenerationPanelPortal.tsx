import { createPortal } from "react-dom";
import { useCallback, type MutableRefObject, type RefObject } from "react";
import { ImageGenerationPanel } from "@/components/nodes/ImageGenerationPanel";
import { NODE_CHROME_GEN_PANEL_CLASS } from "@/components/nodes/nodeChrome";
import {
  GEN_PANEL_CHROME_Z,
  useNodeGenerationChrome,
} from "@/hooks/useNodeGenerationChrome";

type Props = {
  nodeId: string;
  anchorRef: RefObject<HTMLElement | null>;
  active: boolean;
  /** 无图态对齐参考图一布局 */
  layout?: "empty" | "default";
  className?: string;
  /** 与 MinimalImageNode 焦点/删除逻辑共用 */
  panelRef?: RefObject<HTMLDivElement | null>;
};

/** 单选展开态：在预览区下缘 Portal 渲染图片生成面板（无图常驻；有图需钉住） */
export function ImageGenerationPanelPortal({
  nodeId,
  anchorRef,
  active,
  layout = "empty",
  className = NODE_CHROME_GEN_PANEL_CLASS,
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
      className={`${className}${layout === "empty" ? " igp-layout-empty" : ""}`}
      style={{
        position: "fixed",
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        transform: "translateX(-50%)",
        zIndex: GEN_PANEL_CHROME_Z,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <ImageGenerationPanel nodeId={nodeId} layout={layout} />
    </div>,
    document.body,
  );
}
