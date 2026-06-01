import { useCallback, type MutableRefObject, type RefObject } from "react";
import { ImageGenerationPanel } from "@/components/nodes/ImageGenerationPanel";
import { NODE_CHROME_GEN_PANEL_CLASS } from "@/components/nodes/nodeChrome";
import { useNodeChromeMount } from "@/components/nodes/nodeChrome/NodeChromeContext";
import { NodeChromePortalShell } from "@/components/nodes/nodeChrome/NodeChromePortalShell";
import { useNodeGenerationChrome } from "@/hooks/useNodeGenerationChrome";

type Props = {
  nodeId: string;
  anchorRef: RefObject<HTMLElement | null>;
  active: boolean;
  className?: string;
  /** 与 MinimalImageNode 焦点/删除逻辑共用 */
  panelRef?: RefObject<HTMLDivElement | null>;
  /** 预览区正中 overlay，生成胶囊 Portal 挂载点 */
  previewOverlayEl?: HTMLElement | null;
};

/** 单选展开态：在预览区下缘 Portal 渲染图片生成面板 */
export function ImageGenerationPanelPortal({
  nodeId,
  anchorRef,
  active,
  className = NODE_CHROME_GEN_PANEL_CLASS,
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
      className={className}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <ImageGenerationPanel nodeId={nodeId} layout="portal" previewOverlayEl={previewOverlayEl} />
    </NodeChromePortalShell>
  );
}
