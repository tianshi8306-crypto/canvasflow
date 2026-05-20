import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import {
  IMAGE_ASPECT_OPTIONS,
  IMAGE_RESOLUTION_TIERS,
  type ImageAspectId,
  type ImageResolutionTierId,
} from "@/lib/imageGeneration/catalog";
import { ImageAspectWireframe } from "./ImageAspectWireframe";

/** 高于生成面板 Portal，避免被节点裁切 */
export const IMAGE_AR_MENU_Z = 1200;

const MENU_SELECTOR = ".igp-ar-menu--portal";

type Props = {
  aspect: ImageAspectId;
  resolution: ImageResolutionTierId;
  onAspectChange: (id: ImageAspectId) => void;
  onResolutionChange: (id: ImageResolutionTierId) => void;
  onOpenChange?: (open: boolean) => void;
};

export function ImageAspectResolutionPicker({
  aspect,
  resolution,
  onAspectChange,
  onResolutionChange,
  onOpenChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const aspectLabel = useMemo(
    () => IMAGE_ASPECT_OPTIONS.find((a) => a.id === aspect)?.label ?? aspect,
    [aspect],
  );

  const setOpenSafe = useCallback(
    (next: boolean) => {
      setOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }

    const update = () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const width = Math.min(400, window.innerWidth - 24);
      const half = width / 2;
      const centerX = rect.left + rect.width / 2;
      const left = Math.max(half + 12, Math.min(centerX, window.innerWidth - half - 12));
      const gap = 10;
      const maxHeight = Math.min(520, Math.max(200, rect.top - gap - 16));

      setMenuStyle({
        position: "fixed",
        left,
        top: rect.top - gap,
        transform: "translate(-50%, -100%)",
        width,
        maxHeight,
        zIndex: IMAGE_AR_MENU_Z,
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
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target)) return;
      const menu = document.querySelector(MENU_SELECTOR);
      if (menu?.contains(target)) return;
      setOpenSafe(false);
    };
    const t = window.setTimeout(() => {
      document.addEventListener("pointerdown", onPointerDown, true);
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open, setOpenSafe]);

  const menu =
    open && menuStyle && typeof document !== "undefined"
      ? createPortal(
          <div
            className="igp-ar-menu igp-ar-menu--portal imageGenPanel--minimal"
            style={menuStyle}
            role="dialog"
            aria-label="分辨率与比例"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <section className="igp-ar-menu-section">
              <div className="igp-ar-menu-heading">分辨率</div>
              <div className="igp-ar-res-row">
                {IMAGE_RESOLUTION_TIERS.map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    className={`igp-ar-res-btn${resolution === tier.id ? " selected" : ""}`}
                    onClick={() => onResolutionChange(tier.id)}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>
            </section>
            <section className="igp-ar-menu-section">
              <div className="igp-ar-menu-heading">比例</div>
              <div className="igp-ar-ratio-grid">
                {IMAGE_ASPECT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`igp-ar-ratio-btn${aspect === opt.id ? " selected" : ""}`}
                    onClick={() => onAspectChange(opt.id)}
                  >
                    <ImageAspectWireframe id={opt.id} />
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="igp-ar-picker">
      <button
        ref={triggerRef}
        type="button"
        className={`igp-ar-trigger${open ? " open" : ""}`}
        title="分辨率与比例"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpenSafe(!open);
        }}
      >
        <span className="igp-ar-trigger-wire">
          <ImageAspectWireframe id={aspect} compact />
        </span>
        <span className="igp-ar-trigger-label">
          {aspectLabel}
          <span className="igp-ar-trigger-sep">·</span>
          {resolution}
        </span>
        <svg className="igp-ar-trigger-chevron" viewBox="0 0 24 24" aria-hidden>
          <path
            d="M7 14l5-5 5 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {menu}
    </div>
  );
}
