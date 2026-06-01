import { useCallback, type MutableRefObject, type ReactNode, type RefObject } from "react";
import { NODE_CHROME_TEXT_PANEL_CLASS } from "@/components/nodes/nodeChrome";
import { useNodeChromeMount } from "@/components/nodes/nodeChrome/NodeChromeContext";
import { NodeChromePortalShell } from "@/components/nodes/nodeChrome/NodeChromePortalShell";
import {
  GEN_PANEL_CHROME_WIDTH,
  useNodeGenerationChrome,
} from "@/hooks/useNodeGenerationChrome";

type Props = {
  anchorRef: RefObject<HTMLElement | null>;
  active: boolean;
  /** 与图片节点底栏同宽（500px）；预览壳宽度独立 */
  panelWidth?: number;
  panelRef?: RefObject<HTMLDivElement | null>;
  children: ReactNode;
};

/** 文本节点底栏：Portal 锚在预览壳下缘（对齐图片生成面板） */
export function TextNodeBottomPortal({
  anchorRef,
  active,
  panelWidth = GEN_PANEL_CHROME_WIDTH,
  panelRef: externalPanelRef,
  children,
}: Props) {
  const chromeMount = useNodeChromeMount();
  const { pos, panelRef: innerPanelRef } = useNodeGenerationChrome(anchorRef, {
    active,
    panelWidth,
    mountRef: chromeMount?.mountRef,
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

  return (
    <NodeChromePortalShell
      active={active}
      pos={pos}
      setPanelRef={setPanelRef}
      className={NODE_CHROME_TEXT_PANEL_CLASS}
      style={{
        width: `${panelWidth}px`,
        maxWidth: "calc(100vw - 24px)",
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </NodeChromePortalShell>
  );
}
