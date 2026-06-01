import { useCallback, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent } from "react";

const REORDER_DRAG_THRESHOLD_PX = 6;

export function findRefStripDropTargetAt(
  thumbElRefs: Map<string, HTMLDivElement>,
  dragEdgeId: string,
  clientX: number,
  clientY: number,
): string | null {
  let best: { edgeId: string; dist: number } | null = null;
  for (const [edgeId, el] of thumbElRefs) {
    if (edgeId === dragEdgeId) continue;
    const r = el.getBoundingClientRect();
    const padY = 14;
    if (clientY < r.top - padY || clientY > r.bottom + padY) continue;
    const cx = r.left + r.width / 2;
    const dist = Math.abs(clientX - cx);
    if (!best || dist < best.dist) best = { edgeId, dist };
  }
  return best?.edgeId ?? null;
}

type UseVideoRefStripPointerReorderOpts = {
  enabled: boolean;
  thumbElRefs: MutableRefObject<Map<string, HTMLDivElement>>;
  onReorder: (fromEdgeId: string, toEdgeId: string) => void;
  onDragSessionStart?: () => void;
  suppressClickRef: MutableRefObject<boolean>;
};

/**
 * 参考条缩略图指针拖放换位（React Flow nodrag 区域内 HTML5 DnD 不可靠，故用手势实现）。
 */
export function useVideoRefStripPointerReorder({
  enabled,
  thumbElRefs,
  onReorder,
  onDragSessionStart,
  suppressClickRef,
}: UseVideoRefStripPointerReorderOpts) {
  const [dragEdgeId, setDragEdgeId] = useState<string | null>(null);
  const [dropEdgeId, setDropEdgeId] = useState<string | null>(null);
  const sessionRef = useRef<{
    edgeId: string;
    pointerId: number;
    startX: number;
    startY: number;
    active: boolean;
  } | null>(null);

  const bindThumbPointerDown = useCallback(
    (edgeId: string) => (e: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || e.button !== 0) return;
      if ((e.target as HTMLElement).closest(".mmThumbDelete, .igpRefStrip-delete")) return;

      e.stopPropagation();
      e.preventDefault();

      const captureEl = e.currentTarget;
      try {
        captureEl.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }

      sessionRef.current = {
        edgeId,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        active: false,
      };

      const onMove = (ev: PointerEvent) => {
        const s = sessionRef.current;
        if (!s || ev.pointerId !== s.pointerId) return;
        const moved = Math.hypot(ev.clientX - s.startX, ev.clientY - s.startY);
        if (!s.active) {
          if (moved < REORDER_DRAG_THRESHOLD_PX) return;
          s.active = true;
          suppressClickRef.current = true;
          onDragSessionStart?.();
          setDragEdgeId(s.edgeId);
        }
        ev.preventDefault();
        const target = findRefStripDropTargetAt(
          thumbElRefs.current,
          s.edgeId,
          ev.clientX,
          ev.clientY,
        );
        setDropEdgeId(target);
      };

      const finish = (ev: PointerEvent) => {
        const s = sessionRef.current;
        if (!s || ev.pointerId !== s.pointerId) return;
        if (s.active) {
          const target =
            findRefStripDropTargetAt(
              thumbElRefs.current,
              s.edgeId,
              ev.clientX,
              ev.clientY,
            ) ?? null;
          if (target && target !== s.edgeId) onReorder(s.edgeId, target);
        }
        sessionRef.current = null;
        setDragEdgeId(null);
        setDropEdgeId(null);
        try {
          captureEl.releasePointerCapture(ev.pointerId);
        } catch {
          /* ignore */
        }
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
    },
    [enabled, onDragSessionStart, onReorder, suppressClickRef, thumbElRefs],
  );

  const consumeClickSuppressed = useCallback(() => {
    if (!suppressClickRef.current) return false;
    suppressClickRef.current = false;
    return true;
  }, [suppressClickRef]);

  return {
    dragEdgeId,
    dropEdgeId,
    bindThumbPointerDown,
    consumeClickSuppressed,
  };
}
