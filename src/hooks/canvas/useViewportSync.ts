import { useEffect, useRef } from "react";
import type { Viewport } from "@xyflow/react";
import { viewportNearlyEqual } from "@/store/projectHistory";

interface UseViewportSyncOptions {
  viewport: Viewport;
  getViewport: () => Viewport;
  setViewport: (vp: Viewport) => Promise<unknown>;
  /** 工程切换时同步一次即可；勿监听 viewport 否则 onMoveEnd ↔ setViewport 死循环 */
  syncKey: string;
}

export function useViewportSync({
  viewport,
  getViewport,
  setViewport,
  syncKey,
}: UseViewportSyncOptions) {
  const viewportProgrammaticSyncRef = useRef(false);
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  useEffect(() => {
    let cancelled = false;
    const target = viewportRef.current;
    const cur = getViewport();
    if (viewportNearlyEqual(cur, target)) {
      return;
    }
    viewportProgrammaticSyncRef.current = true;
    void (async () => {
      try {
        await setViewport(target);
      } finally {
        window.setTimeout(() => {
          if (!cancelled) viewportProgrammaticSyncRef.current = false;
        }, 120);
      }
    })();
    return () => {
      cancelled = true;
      viewportProgrammaticSyncRef.current = false;
    };
  }, [syncKey, getViewport, setViewport]);

  return { viewportProgrammaticSyncRef };
}
