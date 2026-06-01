import { useEffect, type RefObject } from "react";
import { useCanvasUiStore } from "@/store/canvasUiStore";

const OPEN_CLICK_GUARD_MS = 80;

/** 点击外部 / Esc 关闭锚点菜单（含连线、画布空白等 React Flow 吞掉 click 的场景） */
export function useAnchorMenuDismiss(
  open: boolean,
  close: () => void,
  popRef: RefObject<HTMLDivElement | null>,
  zoneRefs: RefObject<HTMLElement | null>[],
) {
  useEffect(() => {
    if (!open) return;
    const shouldIgnoreOpenClick = () => {
      const openedAt = useCanvasUiStore.getState().anchorMenuOpenedAt;
      return openedAt > 0 && Date.now() - openedAt < OPEN_CLICK_GUARD_MS;
    };
    const onDoc = (e: MouseEvent) => {
      if (shouldIgnoreOpenClick()) return;
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (popRef.current?.contains(t)) return;
      if (zoneRefs.some((ref) => ref.current?.contains(t))) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onDoc, true);
    document.addEventListener("click", onDoc, true);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc, true);
      document.removeEventListener("click", onDoc, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [close, open, popRef, zoneRefs]);
}
