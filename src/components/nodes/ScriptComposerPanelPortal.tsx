import { useCallback, type MutableRefObject, type RefObject } from "react";
import { ScriptComposerPanel } from "@/components/nodes/ScriptComposerPanel";
import { NODE_CHROME_SCRIPT_PANEL_CLASS } from "@/components/nodes/nodeChrome";
import { useNodeChromeMount } from "@/components/nodes/nodeChrome/NodeChromeContext";
import { NodeChromePortalShell } from "@/components/nodes/nodeChrome/NodeChromePortalShell";
import {
  GEN_PANEL_CHROME_WIDTH,
  useNodeGenerationChrome,
} from "@/hooks/useNodeGenerationChrome";

type Props = {
  nodeId: string;
  anchorRef: RefObject<HTMLElement | null>;
  active: boolean;
  /** 无镜头空态：隐藏 Zone A（对标文本 hideChromeHead） */
  hideChromeHead?: boolean;
  panelWidth?: number;
  panelRef?: RefObject<HTMLDivElement | null>;
};

/** 单选展开态：在预览壳下缘 Portal 渲染脚本主题/生成面板（宽 500px，对齐文本底栏） */
export function ScriptComposerPanelPortal({
  nodeId,
  anchorRef,
  active,
  hideChromeHead = false,
  panelWidth = GEN_PANEL_CHROME_WIDTH,
  panelRef: externalPanelRef,
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
      className={NODE_CHROME_SCRIPT_PANEL_CLASS}
      style={{
        width: `${panelWidth}px`,
        maxWidth: "calc(100vw - 24px)",
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <ScriptComposerPanel nodeId={nodeId} layout="default" hideChromeHead={hideChromeHead} />
    </NodeChromePortalShell>
  );
}
