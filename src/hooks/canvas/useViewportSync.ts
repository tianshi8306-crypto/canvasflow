import { useEffect, useRef } from "react";
import type { Viewport } from "@xyflow/react";

interface UseViewportSyncOptions {
  viewport: Viewport;
  getViewport: () => Viewport;
  setViewport: (vp: Viewport) => Promise<unknown>;
}

export function useViewportSync({
  viewport,
  getViewport,
  setViewport,
}: UseViewportSyncOptions) {
  /** 避免 store→setViewport 触发的 onMoveEnd 再次 commit，形成视口抖动/死循环 */
  const viewportProgrammaticSyncRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const cur = getViewport();
    if (
      Math.abs(cur.x - viewport.x) < 0.5 &&
      Math.abs(cur.y - viewport.y) < 0.5 &&
      Math.abs(cur.zoom - viewport.zoom) < 0.0001
    ) {
      return;
    }
    viewportProgrammaticSyncRef.current = true;
    void (async () => {
      try {
        await setViewport(viewport);
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
  }, [viewport, getViewport, setViewport]);

  return { viewportProgrammaticSyncRef };
}
