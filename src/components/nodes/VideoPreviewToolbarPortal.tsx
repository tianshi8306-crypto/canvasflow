import { createPortal } from "react-dom";
import {
  useCallback,
  useLayoutEffect,
  useState,
  type MutableRefObject,
  type RefObject,
} from "react";
import { NODE_CHROME_PANEL_CLASS, NODE_CHROME_TOP_CLASS } from "@/components/nodes/nodeChrome";
import { GEN_PANEL_CHROME_Z, useNodeGenerationChrome } from "@/hooks/useNodeGenerationChrome";
import { VideoPreviewToolbar } from "@/components/nodes/VideoPreviewToolbar";

type Props = {
  nodeId: string;
  anchorRef: RefObject<HTMLElement | null>;
  active: boolean;
  toolbarRef?: RefObject<HTMLDivElement | null>;
};

/** 有视频且选中：预览区上方外部 Portal 功能栏 */
export function VideoPreviewToolbarPortal({
  nodeId,
  anchorRef,
  active,
  toolbarRef: externalToolbarRef,
}: Props) {
  const { pos, panelRef: innerToolbarRef } = useNodeGenerationChrome(anchorRef, {
    active,
    placement: "above",
    aboveGap: 2,
    aboveExtra: 0,
  });
  const [anchorWidth, setAnchorWidth] = useState<number | null>(null);

  const setToolbarRef = useCallback(
    (el: HTMLDivElement | null) => {
      (innerToolbarRef as MutableRefObject<HTMLDivElement | null>).current = el;
      if (externalToolbarRef) {
        (externalToolbarRef as MutableRefObject<HTMLDivElement | null>).current = el;
      }
    },
    [innerToolbarRef, externalToolbarRef],
  );

  useLayoutEffect(() => {
    if (!active) {
      setAnchorWidth(null);
      return;
    }
    const el = anchorRef.current;
    if (!el) return;
    const measure = () => setAnchorWidth(el.getBoundingClientRect().width);
    measure();
    let raf = 0;
    const tick = () => {
      measure();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, anchorRef, pos]);

  if (!active || !pos || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={setToolbarRef}
      className={`${NODE_CHROME_PANEL_CLASS} ${NODE_CHROME_TOP_CLASS} videoPreviewToolbarChrome`}
      style={{
        position: "fixed",
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        transform: "translate(-50%, -100%)",
        width: anchorWidth != null ? `${anchorWidth}px` : undefined,
        zIndex: GEN_PANEL_CHROME_Z,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <VideoPreviewToolbar nodeId={nodeId} />
    </div>,
    document.body,
  );
}
