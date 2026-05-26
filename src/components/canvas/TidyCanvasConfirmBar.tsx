import { useId } from "react";
import { createPortal } from "react-dom";

import { CANVAS_Z } from "@/components/canvas/menuConstants";

import "./TidyCanvasConfirmBar.css";

type Props = {
  open: boolean;
  movedCount: number;
  onUndo: () => void;
  onConfirm: () => void;
};

export function TidyCanvasConfirmBar({ open, movedCount, onUndo, onConfirm }: Props) {
  const titleId = useId();

  if (!open || typeof document === "undefined") return null;

  const hint = movedCount > 1 ? `已重排 ${movedCount} 个节点` : "已适配视口";

  return createPortal(
    <div
      className="tidyCanvasConfirm"
      style={{ zIndex: CANVAS_Z.tidyConfirm }}
      role="alertdialog"
      aria-modal="false"
      aria-labelledby={titleId}
    >
      <div className="tidyCanvasConfirm__shell canvasFloatMenuShell">
        <p id={titleId} className="tidyCanvasConfirm__text">
          <span className="tidyCanvasConfirm__title">画布已整理</span>
          <span className="tidyCanvasConfirm__hint">{hint}</span>
        </p>
        <div className="tidyCanvasConfirm__actions">
          <button type="button" className="tidyCanvasConfirm__btn" onClick={onUndo}>
            还原
            <kbd className="tidyCanvasConfirm__kbd">Esc</kbd>
          </button>
          <button
            type="button"
            className="tidyCanvasConfirm__btn tidyCanvasConfirm__btn--primary"
            onClick={onConfirm}
          >
            保留
            <kbd className="tidyCanvasConfirm__kbd">↵</kbd>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
