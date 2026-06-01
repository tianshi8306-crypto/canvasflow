import { useCallback, useEffect, useRef, useState } from "react";
import { IMAGE_COUNT_OPTIONS } from "@/lib/imageGeneration/catalog";

type Props = {
  value: number;
  onChange: (count: number) => void;
  onOpenChange?: (open: boolean) => void;
};

/**
 * 张数选择：菜单在 picker 内 absolute 定位（bottom: 100%），
 * 勿 Portal + 勿在浮层根节点挂 `imageGenPanel--minimal`（会套用面板 min-height/padding，且后代 CSS 不生效）。
 */
export function ImageCountPicker({ value, onChange, onOpenChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const label =
    IMAGE_COUNT_OPTIONS.find((opt) => opt.id === value)?.label ??
    `${value}张`;

  const setOpenSafe = useCallback(
    (next: boolean) => {
      setOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
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

  return (
    <div
      ref={rootRef}
      className={`igp-count-picker${open ? " is-open" : ""}`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {open ? (
        <div className="igp-count-menu" role="listbox" aria-label="生成张数">
          {IMAGE_COUNT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="option"
              aria-selected={value === opt.id}
              className={`igp-count-option${value === opt.id ? " selected" : ""}`}
              onClick={() => {
                onChange(opt.id);
                setOpenSafe(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        className="igp-count-trigger"
        title="生成张数"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpenSafe(!open)}
      >
        <span className="igp-count-trigger-label">{label}</span>
        <svg className="igp-count-trigger-chevron" viewBox="0 0 24 24" aria-hidden>
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
    </div>
  );
}
