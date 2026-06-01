import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { MaterialLibraryContent } from "@/components/MaterialLibraryContent";
import "./MaterialLibrary.css";

type Props = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
};

export function MaterialLibraryModal({ open, anchorRef, onClose }: Props) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (open) setRefreshKey((k) => k + 1);
  }, [open]);

  const style = useMemo((): CSSProperties | undefined => {
    if (!open) return undefined;
    const anchorEl = anchorRef.current;
    if (!anchorEl) return undefined;
    const rect = anchorEl.getBoundingClientRect();
    const modalW = Math.min(560, window.innerWidth - 88);
    const gap = 12;
    let left = rect.right + gap;
    if (left + modalW > window.innerWidth - 16) {
      left = Math.max(16, window.innerWidth - modalW - 16);
    }
    const top = Math.max(16, Math.min(rect.top - 40, window.innerHeight - 520 - 16));
    return { left, top, width: modalW };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const anchorEl = anchorRef.current;
      if (anchorEl?.contains(target)) return;
      if (modalRef.current?.contains(target)) return;
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
      ref={modalRef}
      className="materialLibraryModal"
      role="dialog"
      aria-modal="true"
      aria-label="我的素材"
      style={style}
    >
      <div className="materialLibraryModalHead">
        <span className="materialLibraryModalTitle">我的素材</span>
        <button type="button" className="materialLibraryModalClose" onClick={onClose} aria-label="关闭">
          ×
        </button>
      </div>
      <MaterialLibraryContent key={refreshKey} onInserted={onClose} />
    </div>,
    document.body,
  );
}
