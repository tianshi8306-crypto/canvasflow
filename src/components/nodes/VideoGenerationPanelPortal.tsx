import { useCallback, type MutableRefObject, type RefObject } from "react";
import { NODE_CHROME_VIDEO_PANEL_CLASS } from "@/components/nodes/nodeChrome";
import { useNodeChromeMount } from "@/components/nodes/nodeChrome/NodeChromeContext";
import { NodeChromePortalShell } from "@/components/nodes/nodeChrome/NodeChromePortalShell";
import { useNodeGenerationChrome } from "@/hooks/useNodeGenerationChrome";
import { VideoMultimodalInputPanel } from "@/components/nodes/VideoMultimodalInputPanel";

type Props = {
  nodeId: string;
  anchorRef: RefObject<HTMLElement | null>;
  active: boolean;
  panelRef?: RefObject<HTMLDivElement | null>;
  /** 预览区正中 overlay，生成胶囊 Portal 挂载点 */
  previewOverlayEl?: HTMLElement | null;
};

/** 单选展开态：在预览区下缘 Portal 渲染视频多模态生成面板 */
export function VideoGenerationPanelPortal({
  nodeId,
  anchorRef,
  active,
  panelRef: externalPanelRef,
  previewOverlayEl = null,
}: Props) {
  const chromeMount = useNodeChromeMount();
  const { pos, panelRef: innerPanelRef } = useNodeGenerationChrome(anchorRef, {
    active,
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
      className={NODE_CHROME_VIDEO_PANEL_CLASS}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <VideoMultimodalInputPanel
        videoNodeId={nodeId}
        layout="portal"
        previewOverlayEl={previewOverlayEl}
      />
    </NodeChromePortalShell>
  );
}
