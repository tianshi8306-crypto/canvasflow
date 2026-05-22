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
import type { TextNodeProviderOption } from "@/lib/textNodeProviders";

export const TEXT_PROVIDER_MENU_Z = 1200;

const MENU_SELECTOR = ".tgp-model-menu--portal";

type Props = {
  providers: TextNodeProviderOption[];
  value: string;
  onChange: (providerId: string) => void;
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

/** 文本节点模型 Provider 选择（对齐 ImageModelPicker Portal 菜单） */
export function TextProviderPicker({
  providers,
  value,
  onChange,
  onOpenChange,
  loading = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const ordered = useMemo(
    () => [...providers].sort((a, b) => a.priority - b.priority),
    [providers],
  );

  const enabled = useMemo(() => ordered.filter((p) => p.enabled), [ordered]);

  const selected = useMemo(
    () => ordered.find((p) => p.id === value) ?? enabled[0] ?? null,
    [ordered, enabled, value],
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
      const width = Math.min(360, window.innerWidth - 24);
      const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
      const gap = 10;
      const maxHeight = Math.min(360, Math.max(160, rect.top - gap - 16));

      setMenuStyle({
        position: "fixed",
        left,
        top: rect.top - gap,
        transform: "translateY(-100%)",
        width,
        maxHeight,
        zIndex: TEXT_PROVIDER_MENU_Z,
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

  const triggerLabel = loading
    ? "加载模型…"
    : value
      ? (selected?.label ?? "Provider")
      : "默认模型";

  const menu =
    open && menuStyle && typeof document !== "undefined" ? (
      createPortal(
        <div
          className="igp-model-menu tgp-model-menu tgp-model-menu--portal imageGenPanel--minimal textGenPanel--chrome"
          style={menuStyle}
          role="listbox"
          aria-label="文本模型"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="igp-model-menu-scroll">
            <button
              type="button"
              role="option"
              aria-selected={!value}
              className={`igp-model-item${!value ? " selected" : ""}`}
              onClick={() => {
                onChange("");
                setOpenSafe(false);
              }}
            >
              <span className="igp-model-item-icon" aria-hidden>
                ∅
              </span>
              <span className="igp-model-item-body">
                <span className="igp-model-item-title">默认模型</span>
                <span className="igp-model-item-subtitle">使用设置中优先级最高的 Provider</span>
              </span>
            </button>
            {enabled.map((p) => {
              const isSelected = p.id === value;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={!p.enabled}
                  className={`igp-model-item${isSelected ? " selected" : ""}${!p.enabled ? " disabled" : ""}`}
                  onClick={() => {
                    if (!p.enabled) return;
                    onChange(p.id);
                    setOpenSafe(false);
                  }}
                >
                  <span className="igp-model-item-icon" aria-hidden>
                    {p.label.slice(0, 1)}
                  </span>
                  <span className="igp-model-item-body">
                    <span className="igp-model-item-title-row">
                      <span className="igp-model-item-title">{p.label}</span>
                    </span>
                    <span className="igp-model-item-subtitle">{p.model}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>,
        document.body,
      )
    ) : null;

  return (
    <div className="igp-model-picker tgp-model-picker tgp-model-picker--pill">
      <button
        ref={triggerRef}
        type="button"
        className={`igp-model-trigger tgp-model-trigger tgp-model-trigger--pill${open ? " open" : ""}`}
        title="语言模型"
        disabled={loading}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          if (loading) return;
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
