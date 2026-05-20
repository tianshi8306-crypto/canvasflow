import { useEffect, useRef, useState, type RefObject } from "react";
import type { Node } from "@xyflow/react";

interface UseMarqueeSelectionOptions {
  wrapRef: RefObject<HTMLDivElement | null>;
  screenToFlowPosition: (p: { x: number; y: number }) => { x: number; y: number };
  getIntersectingNodes: (
    rect: { x: number; y: number; width: number; height: number },
    a: boolean,
    nodes: Node[],
  ) => Node[];
  nodes: Node[];
  selectNodesByIds: (ids: string[]) => void;
}

export function useMarqueeSelection({
  wrapRef,
  screenToFlowPosition,
  getIntersectingNodes,
  nodes,
  selectNodesByIds,
}: UseMarqueeSelectionOptions) {
  const [marqueeRect, setMarqueeRect] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  const marqueeDragRef = useRef<{ sx: number; sy: number } | null>(null);
  const marqueeGeomRef = useRef<{ x: number; y: number; w: number; h: number } | null>(
    null,
  );
  const suppressPaneContextRef = useRef(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 2) return;
      const t = e.target as HTMLElement | null;
      if (!t?.closest(".react-flow__pane")) return;
      if (t.closest(".react-flow__node") || t.closest(".react-flow__edge")) return;
      e.preventDefault();
      e.stopPropagation();
      marqueeDragRef.current = { sx: e.clientX, sy: e.clientY };
      const g = { x: e.clientX, y: e.clientY, w: 0, h: 0 };
      marqueeGeomRef.current = g;
      setMarqueeRect(g);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!marqueeDragRef.current) return;
      e.preventDefault();
      const { sx, sy } = marqueeDragRef.current;
      const x = Math.min(sx, e.clientX);
      const y = Math.min(sy, e.clientY);
      const w = Math.abs(e.clientX - sx);
      const h = Math.abs(e.clientY - sy);
      const g = { x, y, w, h };
      marqueeGeomRef.current = g;
      setMarqueeRect(g);
    };

    const finishMarquee = () => {
      if (!marqueeDragRef.current) return;
      marqueeDragRef.current = null;
      const r = marqueeGeomRef.current;
      marqueeGeomRef.current = null;
      setMarqueeRect(null);
      if (!r || r.w < 8 || r.h < 8) return;
      const p1 = screenToFlowPosition({ x: r.x, y: r.y });
      const p2 = screenToFlowPosition({ x: r.x + r.w, y: r.y + r.h });
      const rect = {
        x: Math.min(p1.x, p2.x),
        y: Math.min(p1.y, p2.y),
        width: Math.abs(p2.x - p1.x),
        height: Math.abs(p2.y - p1.y),
      };
      const intersecting = getIntersectingNodes(rect, true, nodes);
      const ids = intersecting.map((n) => n.id);
      if (ids.length > 0) {
        suppressPaneContextRef.current = true;
        selectNodesByIds(ids);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!marqueeDragRef.current) return;
      if (e.pointerType === "mouse" && e.button !== 2) return;
      finishMarquee();
    };

    const onPointerCancel = () => {
      if (!marqueeDragRef.current) return;
      marqueeDragRef.current = null;
      marqueeGeomRef.current = null;
      setMarqueeRect(null);
    };

    el.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("pointercancel", onPointerCancel, true);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("pointercancel", onPointerCancel, true);
    };
  }, [
    wrapRef,
    screenToFlowPosition,
    getIntersectingNodes,
    nodes,
    selectNodesByIds,
  ]);

  return {
    marqueeRect,
    suppressPaneContextRef,
  };
}
