import { useEffect, useRef, type RefObject } from "react";
import type { Viewport } from "@xyflow/react";

const WHEEL_PAN_SENSITIVITY = 1;
const WHEEL_COMMIT_MS = 120;

type Options = {
  getViewport: () => Viewport;
  setViewport: (vp: Viewport) => Promise<unknown>;
  commitViewport: (vp: Viewport) => void;
  setViewportInteracting: (v: boolean) => void;
};

/**
 * Alt + 滚轮：画布垂直平移；Shift + 滚轮：画布水平平移（拦截默认缩放）。
 */
export function useCanvasModifierWheelPan(wrapRef: RefObject<HTMLDivElement | null>, options: Options) {
  const commitTimerRef = useRef<number | undefined>(undefined);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const root = wrapRef.current;
    if (!root) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return;

      const alt = e.altKey;
      const shift = e.shiftKey;
      if (!alt && !shift) return;
      if (alt && shift) return;

      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (!root.contains(target)) return;
      if (target.closest(".nowheel")) return;
      if (
        target.closest(
          "input, textarea, select, [contenteditable='true'], [contenteditable='plaintext-only']",
        )
      ) {
        return;
      }
      if (!target.closest(".react-flow__pane, .react-flow__renderer")) return;

      e.preventDefault();
      e.stopPropagation();

      const { getViewport, setViewport, commitViewport, setViewportInteracting } = optionsRef.current;
      const vp = getViewport();

      if (alt) {
        void setViewport({
          ...vp,
          y: vp.y - e.deltaY * WHEEL_PAN_SENSITIVITY,
        });
      } else {
        const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        void setViewport({
          ...vp,
          x: vp.x - dx * WHEEL_PAN_SENSITIVITY,
        });
      }

      setViewportInteracting(true);
      if (commitTimerRef.current !== undefined) {
        window.clearTimeout(commitTimerRef.current);
      }
      commitTimerRef.current = window.setTimeout(() => {
        commitTimerRef.current = undefined;
        commitViewport(getViewport());
        setViewportInteracting(false);
      }, WHEEL_COMMIT_MS);
    };

    root.addEventListener("wheel", onWheel, { capture: true, passive: false });
    return () => {
      root.removeEventListener("wheel", onWheel, { capture: true });
      if (commitTimerRef.current !== undefined) {
        window.clearTimeout(commitTimerRef.current);
      }
    };
  }, [wrapRef]);
}
