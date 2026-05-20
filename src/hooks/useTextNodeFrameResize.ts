import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { useReactFlow } from "@xyflow/react";
import {
  TEXT_NODE_CHROME_HEIGHT_EMPTY,
  TEXT_NODE_CHROME_MAX_HEIGHT,
  TEXT_NODE_CHROME_MAX_WIDTH,
  TEXT_NODE_CHROME_MIN_HEIGHT,
  TEXT_NODE_CHROME_MIN_WIDTH,
  TEXT_NODE_CHROME_WIDTH,
} from "@/lib/textNodeChrome";
import { useProjectStore } from "@/store/projectStore";

type TextChromeSizeParams = {
  chromeWidth?: number;
  chromeHeight?: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function useTextNodeFrameResize(nodeId: string, enabled: boolean) {
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const nodes = useProjectStore((s) => s.nodes);
  const { getZoom } = useReactFlow();
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);

  const node = nodes.find((n) => n.id === nodeId);
  const params =
    node?.data.params && typeof node.data.params === "object"
      ? (node.data.params as TextChromeSizeParams)
      : {};

  const onResizePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled) return;
      e.stopPropagation();
      e.preventDefault();
      const w = params.chromeWidth ?? TEXT_NODE_CHROME_WIDTH;
      const h = params.chromeHeight ?? TEXT_NODE_CHROME_HEIGHT_EMPTY;
      dragRef.current = { startX: e.clientX, startY: e.clientY, startW: w, startH: h };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [enabled, params.chromeHeight, params.chromeWidth],
  );

  useEffect(() => {
    if (!enabled) return;

    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const zoom = getZoom() || 1;
      const dw = (e.clientX - drag.startX) / zoom;
      const dh = (e.clientY - drag.startY) / zoom;
      const nextW = clamp(
        Math.round(drag.startW + dw),
        TEXT_NODE_CHROME_MIN_WIDTH,
        TEXT_NODE_CHROME_MAX_WIDTH,
      );
      const nextH = clamp(
        Math.round(drag.startH + dh),
        TEXT_NODE_CHROME_MIN_HEIGHT,
        TEXT_NODE_CHROME_MAX_HEIGHT,
      );
      const n = useProjectStore.getState().nodes.find((x) => x.id === nodeId);
      const base =
        n?.data.params && typeof n.data.params === "object"
          ? { ...(n.data.params as Record<string, unknown>) }
          : {};
      updateNodeData(nodeId, {
        params: { ...base, chromeWidth: nextW, chromeHeight: nextH },
      });
    };

    const onUp = () => {
      dragRef.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [enabled, getZoom, nodeId, updateNodeData]);

  return { onResizePointerDown };
}
