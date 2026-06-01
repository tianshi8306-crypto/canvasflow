import { useCallback, type MutableRefObject, type RefObject } from "react";
import { AudioTtsPanel } from "@/components/nodes/AudioTtsPanel";
import { NODE_CHROME_AUDIO_PANEL_CLASS } from "@/components/nodes/nodeChrome";
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
  /** 与图片节点底栏同宽（500px）；预览壳宽度独立 */
  panelWidth?: number;
  panelRef?: RefObject<HTMLDivElement | null>;
  onRequestExpand?: () => void;
};

/** 单选展开：预览下缘 Portal 渲染 TTS 面板 */
export function AudioTtsPanelPortal({
  nodeId,
  anchorRef,
  active,
  panelWidth = GEN_PANEL_CHROME_WIDTH,
  panelRef: externalPanelRef,
  onRequestExpand,
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
      className={NODE_CHROME_AUDIO_PANEL_CLASS}
      style={{
        width: `${panelWidth}px`,
        maxWidth: "calc(100vw - 24px)",
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <AudioTtsPanel nodeId={nodeId} onRequestExpand={onRequestExpand} />
    </NodeChromePortalShell>
  );
}
