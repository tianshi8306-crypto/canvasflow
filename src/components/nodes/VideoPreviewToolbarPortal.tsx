import { useCallback, type MutableRefObject, type RefObject } from "react";
import { NODE_CHROME_TOP_CLASS } from "@/components/nodes/nodeChrome";
import { useNodeChromeMount } from "@/components/nodes/nodeChrome/NodeChromeContext";
import { NodeChromePortalShell } from "@/components/nodes/nodeChrome/NodeChromePortalShell";
import {
  GEN_PANEL_CHROME_ABOVE_PREVIEW_GAP,
  useNodeGenerationChrome,
} from "@/hooks/useNodeGenerationChrome";
import { VideoPreviewToolbar } from "@/components/nodes/VideoPreviewToolbar";

type Props = {
  nodeId: string;
  anchorRef: RefObject<HTMLElement | null>;
  active: boolean;
  toolbarRef?: RefObject<HTMLDivElement | null>;
};

/** 有视频且选中：预览区上方外部 Portal（仅功能栏；名称/分辨率钉在预览壳外缘） */
export function VideoPreviewToolbarPortal({
  nodeId,
  anchorRef,
  active,
  toolbarRef: externalToolbarRef,
}: Props) {
  const chromeMount = useNodeChromeMount();
  const { pos, panelRef: innerToolbarRef } = useNodeGenerationChrome(anchorRef, {
    active,
    mountRef: chromeMount?.mountRef,
    placement: "above",
    aboveGap: GEN_PANEL_CHROME_ABOVE_PREVIEW_GAP,
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

  return (
    <NodeChromePortalShell
      active={active}
      pos={pos}
      setPanelRef={setToolbarRef}
      className={`videoPreviewToolbarPortalRoot previewToolbarChrome--stack ${NODE_CHROME_TOP_CLASS}`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <VideoPreviewToolbar nodeId={nodeId} />
    </NodeChromePortalShell>
  );
}
