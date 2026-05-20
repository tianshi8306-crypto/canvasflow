import { useEffect, type RefObject } from "react";

/** 点击外部 / Esc 关闭锚点菜单 */
export function useAnchorMenuDismiss(
  open: boolean,
  close: () => void,
  popRef: RefObject<HTMLDivElement | null>,
  zoneRefs: RefObject<HTMLElement | null>[],
) {
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (popRef.current?.contains(t)) return;
      if (zoneRefs.some((ref) => ref.current?.contains(t))) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("click", onDoc, true);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDoc, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [close, open, popRef, zoneRefs]);
}
