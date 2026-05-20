import { useLayoutEffect, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import "./VideoOutputSettingsPopover.css";

/** 高于画布节点、预览工具栏与生成面板 Portal */
export const VIDEO_OUTPUT_POPOVER_Z = 1200;

const POPOVER_SELECTOR = ".video-output-settings-popover";

type Props = {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

/** 输出参数浮层：Portal 到 body，锚在底栏 pill 上方（图二样式） */
export function VideoOutputSettingsPopover({ anchorRef, open, onClose, children }: Props) {
  const [style, setStyle] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setStyle(null);
      return;
    }

    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const width = Math.min(380, window.innerWidth - 24);
      const half = width / 2;
      const centerX = rect.left + rect.width / 2;
      const left = Math.max(half + 12, Math.min(centerX, window.innerWidth - half - 12));
      const gap = 10;

      setStyle({
        position: "fixed",
        left,
        top: rect.top - gap,
        bottom: "auto",
        right: "auto",
        transform: "translate(-50%, -100%)",
        width,
        zIndex: VIDEO_OUTPUT_POPOVER_Z,
      });
    };

    update();
    const onScrollOrResize = () => update();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    let raf = 0;
    const tick = () => {
      update();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
      cancelAnimationFrame(raf);
    };
  }, [open, anchorRef]);

  useLayoutEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (anchorRef.current?.contains(target)) return;
      const pop = document.querySelector(POPOVER_SELECTOR);
      if (pop?.contains(target)) return;
      onClose();
    };
    const t = window.setTimeout(() => {
      document.addEventListener("pointerdown", onPointerDown, true);
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open, anchorRef, onClose]);

  if (!open || !style || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="video-output-settings-popover"
      style={style}
      role="dialog"
      aria-modal="false"
      aria-label="视频输出参数"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}
