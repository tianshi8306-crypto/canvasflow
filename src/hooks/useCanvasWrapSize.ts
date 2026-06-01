import { useLayoutEffect, useState, type RefObject } from "react";
import { isCanvasWrapMeasurable } from "@/lib/hermes/hermesCanvasDock";

export type CanvasWrapSize = { w: number; h: number };

const MAX_LAYOUT_RETRIES = 120;

export function readCanvasWrapSize(wrap: HTMLDivElement): CanvasWrapSize {
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  if (w > 0 && h > 0) return { w, h };
  const rect = wrap.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) {
    return { w: Math.round(rect.width), h: Math.round(rect.height) };
  }
  return { w: 0, h: 0 };
}

/** 读取 `.canvasWrap` 尺寸；ref 或首帧 layout 未就绪时会 rAF 重试 */
export function useCanvasWrapSize(
  wrapRef: RefObject<HTMLDivElement | null>,
  enabled = true,
): CanvasWrapSize {
  const [size, setSize] = useState<CanvasWrapSize>({ w: 0, h: 0 });

  useLayoutEffect(() => {
    if (!enabled) {
      setSize({ w: 0, h: 0 });
      return;
    }

    let cancelled = false;
    let ro: ResizeObserver | null = null;
    let retryId = 0;
    let retries = 0;

    const apply = (wrap: HTMLDivElement) => {
      const next = readCanvasWrapSize(wrap);
      setSize((prev) =>
        prev.w === next.w && prev.h === next.h ? prev : next,
      );
    };

    const attach = (wrap: HTMLDivElement) => {
      apply(wrap);
      ro?.disconnect();
      ro = new ResizeObserver(() => apply(wrap));
      ro.observe(wrap);
    };

    const tryAttach = (): boolean => {
      const wrap = wrapRef.current;
      if (!wrap || cancelled) return false;
      const measured = readCanvasWrapSize(wrap);
      if (!isCanvasWrapMeasurable(measured.w, measured.h)) return false;
      attach(wrap);
      return true;
    };

    const scheduleRetry = () => {
      if (cancelled || retries >= MAX_LAYOUT_RETRIES) return;
      retries += 1;
      retryId = requestAnimationFrame(() => {
        if (cancelled) return;
        if (!tryAttach()) scheduleRetry();
      });
    };

    if (!tryAttach()) {
      scheduleRetry();
    }

    const onWindowResize = () => {
      const wrap = wrapRef.current;
      if (!wrap || cancelled) return;
      const measured = readCanvasWrapSize(wrap);
      if (isCanvasWrapMeasurable(measured.w, measured.h)) {
        if (!ro) attach(wrap);
        else apply(wrap);
      }
    };
    window.addEventListener("resize", onWindowResize);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", onWindowResize);
      if (retryId) cancelAnimationFrame(retryId);
      ro?.disconnect();
    };
  }, [enabled, wrapRef]);

  return size;
}
