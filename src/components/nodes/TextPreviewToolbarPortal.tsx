import { useCallback, type MutableRefObject, type RefObject } from "react";
import {
  TextPreviewToolbar,
  type TextPreviewToolbarCallbacks,
} from "@/components/nodes/TextPreviewToolbar";
import { useNodeChromeMount } from "@/components/nodes/nodeChrome/NodeChromeContext";
import { NodeChromePortalShell } from "@/components/nodes/nodeChrome/NodeChromePortalShell";
import { useNodeGenerationChrome } from "@/hooks/useNodeGenerationChrome";

type Props = {
  anchorRef: RefObject<HTMLElement | null>;
  active: boolean;
  toolbarRef?: RefObject<HTMLDivElement | null>;
} & TextPreviewToolbarCallbacks;

/** 有正文且单选：预览区上方 Portal（仅功能栏；名称/字数钉在预览壳外缘） */
export function TextPreviewToolbarPortal({
  anchorRef,
  active,
  toolbarRef: externalToolbarRef,
  ...callbacks
}: Props) {
  const chromeMount = useNodeChromeMount();
  const { pos, panelRef: innerToolbarRef } = useNodeGenerationChrome(anchorRef, {
    active,
    mountRef: chromeMount?.mountRef,
    placement: "above",
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
      className="textPreviewToolbarPortalRoot previewToolbarChrome--stack"
      style={{ maxWidth: "min(640px, 96vw)" }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="textPreviewToolbarChrome">
        <TextPreviewToolbar {...callbacks} />
      </div>
    </NodeChromePortalShell>
  );
}
