import { useLayoutEffect, useState, type RefObject } from "react";
import { readCanvasWrapSize } from "@/hooks/useCanvasWrapSize";

export type CanvasWrapScreenRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const EMPTY_RECT: CanvasWrapScreenRect = { left: 0, top: 0, width: 0, height: 0 };

/** 画布 wrap 在视口中的 fixed 定位框（用于灵体层 escape 顶栏 stacking） */
export function useCanvasWrapScreenRect(
  wrapRef: RefObject<HTMLDivElement | null>,
  enabled = true,
): CanvasWrapScreenRect {
  const [rect, setRect] = useState<CanvasWrapScreenRect>(EMPTY_RECT);

  useLayoutEffect(() => {
    if (!enabled) {
      setRect(EMPTY_RECT);
      return;
    }

    let cancelled = false;
    let ro: ResizeObserver | null = null;

    const apply = () => {
      const wrap = wrapRef.current;
      if (!wrap || cancelled) return;
      const bounds = wrap.getBoundingClientRect();
      const measured = readCanvasWrapSize(wrap);
      setRect({
        left: bounds.left,
        top: bounds.top,
        width: measured.w > 0 ? measured.w : bounds.width,
        height: measured.h > 0 ? measured.h : bounds.height,
      });
    };

    apply();
    const wrap = wrapRef.current;
    if (wrap) {
      ro = new ResizeObserver(apply);
      ro.observe(wrap);
    }
    window.addEventListener("resize", apply);
    window.addEventListener("scroll", apply, true);

    return () => {
      cancelled = true;
      ro?.disconnect();
      window.removeEventListener("resize", apply);
      window.removeEventListener("scroll", apply, true);
    };
  }, [enabled, wrapRef]);

  return rect;
}
