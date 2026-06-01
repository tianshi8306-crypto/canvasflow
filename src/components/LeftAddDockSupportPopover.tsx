import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, type CSSProperties, type RefObject } from "react";
import { SUPPORT_QR } from "@/lib/supportContacts";

type Props = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
};

export function LeftAddDockSupportPopover({ open, anchorRef, onClose }: Props) {
  const popoverRef = useRef<HTMLDivElement>(null);

  const style = useMemo((): CSSProperties | undefined => {
    if (!open) return undefined;
    const anchorEl = anchorRef.current;
    if (!anchorEl) return undefined;
    const rect = anchorEl.getBoundingClientRect();
    const popoverW = 200;
    const gap = 10;
    let left = rect.right + gap;
    if (left + popoverW > window.innerWidth - 12) {
      left = Math.max(12, rect.left - popoverW - gap);
    }
    const bottom = Math.max(12, window.innerHeight - rect.bottom + 4);
    return { left, bottom, width: popoverW };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const anchorEl = anchorRef.current;
      if (anchorEl?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, anchorRef, onClose]);

  if (!open || !style) return null;

  return createPortal(
    <div
      ref={popoverRef}
      className="leftAddDockSupportPopover"
      role="dialog"
      aria-label="技术支持"
      style={style}
    >
      <div className="leftAddDockSupportQrPane">
        <img className="leftAddDockSupportQrImg" src={SUPPORT_QR.src} alt={SUPPORT_QR.alt} />
        <p className="leftAddDockSupportQrHint">{SUPPORT_QR.hint}</p>
      </div>
    </div>,
    document.body,
  );
}

export function IconHeadsetSupport() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 12.5V11a8 8 0 0 1 16 0v1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M4 12.5a2 2 0 0 0 2 2v2.5H4v-4.5zM20 12.5a2 2 0 0 1-2 2v2.5h2v-4.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M12 18.5v2M9.5 20.5h5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
