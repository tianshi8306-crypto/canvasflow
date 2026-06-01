import { useCallback, type MutableRefObject, type RefObject } from "react";
import { ImagePreviewToolbar } from "@/components/nodes/ImagePreviewToolbar";
import { useNodeChromeMount } from "@/components/nodes/nodeChrome/NodeChromeContext";
import { NodeChromePortalShell } from "@/components/nodes/nodeChrome/NodeChromePortalShell";
import {
  GEN_PANEL_CHROME_ABOVE_PREVIEW_GAP,
  useNodeGenerationChrome,
} from "@/hooks/useNodeGenerationChrome";

type Props = {
  nodeId: string;
  anchorRef: RefObject<HTMLElement | null>;
  active: boolean;
  hasLocalImage: boolean;
  toolbarRef: RefObject<HTMLDivElement | null>;
};

/** 有图且选中：预览区上方外部 Portal（仅功能栏；名称/分辨率钉在预览壳外缘） */
export function ImagePreviewToolbarPortal({
  nodeId,
  anchorRef,
  active,
  hasLocalImage,
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
      className="imagePreviewToolbarPortalRoot previewToolbarChrome--stack"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <ImagePreviewToolbar nodeId={nodeId} hasLocalImage={hasLocalImage} />
    </NodeChromePortalShell>
  );
}
