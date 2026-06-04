import { useRef, useCallback } from "react";

/**
 * 基于 requestAnimationFrame 的节流 hook。
 * 适合高频事件（scroll、resize、keydown zoom 等），将回调限制在每帧最多一次。
 */
export function useRafThrottle<T extends (...args: never[]) => void>(
  fn: T,
): (...args: Parameters<T>) => void {
  const rafId = useRef<number>(0);
  const lastArgs = useRef<Parameters<T> | null>(null);

  return useCallback(
    (...args: Parameters<T>) => {
      lastArgs.current = args;
      if (rafId.current) return;
      rafId.current = requestAnimationFrame(() => {
        rafId.current = 0;
        if (lastArgs.current) {
          fn(...lastArgs.current);
          lastArgs.current = null;
        }
      });
    },
    [fn],
  );
}

/** 简化版：对给定函数做 RAF 节流，直接返回节流后函数 */
export function throttleRaf<T extends (...args: never[]) => void>(fn: T): T {
  let rafId = 0;
  let pending: Parameters<T> | null = null;
  return ((...args: Parameters<T>) => {
    pending = args;
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      if (pending) {
        fn(...pending);
        pending = null;
      }
    });
  }) as T;
}
