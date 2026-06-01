import { useCallback, useEffect, type RefObject } from "react";

/** 同步 mention 镜像层与 textarea 的滚动/尺寸，避免选区与可见文字错位 */
export function useMentionTextMirror(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  overlayRef: RefObject<HTMLDivElement | null>,
  deps: readonly unknown[] = [],
): void {
  const syncMirror = useCallback(() => {
    const ta = textareaRef.current;
    const ov = overlayRef.current;
    if (!ta || !ov) return;
    ov.scrollTop = ta.scrollTop;
    ov.scrollLeft = ta.scrollLeft;
    // 滚动条只占 textarea 一侧时，给镜像层等量右内边距，保持换行位置一致
    const scrollbarW = Math.max(0, ta.offsetWidth - ta.clientWidth);
    const padInline = getComputedStyle(ta).paddingRight;
    const basePad = Number.parseFloat(padInline) || 0;
    ov.style.paddingRight = scrollbarW > 0 ? `${basePad + scrollbarW}px` : "";
  }, [textareaRef, overlayRef]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    syncMirror();
    ta.addEventListener("scroll", syncMirror, { passive: true });
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => syncMirror());
      ro.observe(ta);
    }
    return () => {
      ta.removeEventListener("scroll", syncMirror);
      ro?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller passes value etc.
  }, [syncMirror, ...deps]);
}
