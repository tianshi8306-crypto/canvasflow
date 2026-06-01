import { useCallback, type MutableRefObject, type RefObject } from "react";
import { FFmpegConcatPanel } from "@/components/nodes/FFmpegConcatPanel";
import { NODE_CHROME_FFMPEG_PANEL_CLASS } from "@/components/nodes/nodeChrome";
import { useNodeChromeMount } from "@/components/nodes/nodeChrome/NodeChromeContext";
import { NodeChromePortalShell } from "@/components/nodes/nodeChrome/NodeChromePortalShell";
import { useNodeGenerationChrome } from "@/hooks/useNodeGenerationChrome";

type Props = {
  nodeId: string;
  anchorRef: RefObject<HTMLElement | null>;
  active: boolean;
  panelRef?: RefObject<HTMLDivElement | null>;
};

/** 单选展开：预览区下缘 Portal 渲染视频合成面板（对齐图片生成面板定位） */
export function FFmpegConcatPanelPortal({
  nodeId,
  anchorRef,
  active,
  panelRef: externalPanelRef,
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
      className={NODE_CHROME_FFMPEG_PANEL_CLASS}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <FFmpegConcatPanel nodeId={nodeId} />
    </NodeChromePortalShell>
  );
}
