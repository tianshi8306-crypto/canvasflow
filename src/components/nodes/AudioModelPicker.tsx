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
import type { AudioModelOption } from "@/hooks/useAudioModels";

export const AUDIO_MODEL_MENU_Z = 1200;

const MENU_SELECTOR = ".amp-model-menu--portal";

type Props = {
  models: AudioModelOption[];
  value: string;
  onChange: (modelId: string) => void;
  onOpenChange?: (open: boolean) => void;
  loading?: boolean;
};

function ModelSparkleIcon() {
  return (
    <svg className="igp-model-trigger-icon" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 2l1.2 4.2L17.5 7.5l-4.3 1.2L12 13l-1.2-4.3L6.5 7.5l4.3-1.3L12 2zm0 11l1.4 4.8L18 19l-4.6-1.3L12 23l-1.4-5.3L6 19l4.6-1.2L12 13z"
        fill="currentColor"
      />
    </svg>
  );
}

export function AudioModelPicker({ models, value, onChange, onOpenChange, loading = false }: Props) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const orderedModels = useMemo(() => [...models], [models]);

  const selectable = useMemo(() => orderedModels.filter((m) => m.enabled), [orderedModels]);

  const selected = useMemo(
    () => orderedModels.find((m) => m.id === value) ?? selectable[0] ?? null,
    [orderedModels, selectable, value],
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
      const width = Math.min(320, window.innerWidth - 24);
      const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
      const gap = 10;
      const maxHeight = Math.min(280, Math.max(140, rect.top - gap - 16));
      setMenuStyle({
        position: "fixed",
        left,
        top: rect.top - gap,
        transform: "translateY(-100%)",
        width,
        maxHeight,
        zIndex: AUDIO_MODEL_MENU_Z,
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
      if (document.querySelector(MENU_SELECTOR)?.contains(target)) return;
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

  const triggerLabel = loading
    ? "加载模型…"
    : (selected?.label ?? selectable[0]?.label ?? "选择语音模型");

  const menu =
    open && selectable.length > 0 && menuStyle && typeof document !== "undefined"
      ? createPortal(
          <div
            className="igp-model-menu igp-model-menu--portal amp-model-menu--portal"
            style={menuStyle}
            role="listbox"
            aria-label="语音模型"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="igp-model-menu-scroll">
              {orderedModels.map((m) => {
                const isSelected = m.id === value;
                const disabled = !m.enabled;
                const iconLetter = (m.label.trim() || m.ttsModel).charAt(0).toUpperCase();
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={disabled}
                    className={`igp-model-item${isSelected ? " selected" : ""}${disabled ? " disabled" : ""}`}
                    onClick={() => {
                      if (disabled) return;
                      onChange(m.id);
                      setOpenSafe(false);
                    }}
                  >
                    <span className="igp-model-item-icon" aria-hidden>
                      {iconLetter}
                    </span>
                    <span className="igp-model-item-body">
                      <span className="igp-model-item-title-row">
                        <span className="igp-model-item-title">{m.label}</span>
                      </span>
                      <span className="igp-model-item-subtitle">{m.ttsModel}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="igp-model-picker">
      <button
        ref={triggerRef}
        type="button"
        className={`igp-model-trigger${open ? " open" : ""}`}
        title="语音模型"
        disabled={loading || selectable.length === 0}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          if (loading || selectable.length === 0) return;
          setOpenSafe(!open);
        }}
      >
        <ModelSparkleIcon />
        <span className="igp-model-trigger-label">{triggerLabel}</span>
        <svg className="igp-model-trigger-chevron" viewBox="0 0 24 24" aria-hidden>
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
