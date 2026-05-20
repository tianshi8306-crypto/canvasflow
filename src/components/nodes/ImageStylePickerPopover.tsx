import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import {
  IMAGE_STYLE_OPTIONS,
  type ImageStyleId,
} from "@/lib/imageGeneration/catalog";

/** 高于画布节点、预览区与生成面板 Portal，避免被图片节点裁切 */
export const IMAGE_STYLE_POPOVER_Z = 1200;

const POPOVER_SELECTOR = ".igp-style-popover";

type Props = {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  selectedIds: ImageStyleId[];
  onToggle: (id: ImageStyleId) => void;
};

/** 风格选择浮层：Portal 到 body，锚在触发按钮上方，样式与生成参数面板一致 */
export function ImageStylePickerPopover({
  anchorRef,
  open,
  onClose,
  selectedIds,
  onToggle,
}: Props) {
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
      const width = Math.min(500, window.innerWidth - 24);
      const half = width / 2;
      const centerX = rect.left + rect.width / 2;
      const left = Math.max(half + 12, Math.min(centerX, window.innerWidth - half - 12));
      const gap = 10;

      setStyle({
        position: "fixed",
        left,
        top: rect.top - gap,
        transform: "translate(-50%, -100%)",
        width,
        zIndex: IMAGE_STYLE_POPOVER_Z,
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
      className="igp-style-popover imageGenPanel--minimal"
      style={style}
      role="dialog"
      aria-modal="false"
      aria-label="选择画风"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="igp-style-popover-inner">
        <div className="igp-style-popover-title">画风</div>
        <div className="igp-style-grid">
          {IMAGE_STYLE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`igp-style-btn${selectedIds.includes(opt.id) ? " active" : ""}`}
              onClick={() => onToggle(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
