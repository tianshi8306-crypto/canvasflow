import { createPortal } from "react-dom";
import type { WheelEvent as ReactWheelEvent } from "react";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";
import "./TextNodeChrome.css";

type Props = {
  open: boolean;
  draft: string;
  maxChars: number;
  onDraftChange: (value: string) => void;
  onClose: () => void;
  onCommit: () => void;
  onWheel: (e: ReactWheelEvent) => void;
};

export function TextNodeExpandEditModal({
  open,
  draft,
  maxChars,
  onDraftChange,
  onClose,
  onCommit,
  onWheel,
}: Props) {
  if (!open) return null;
  return createPortal(
    <div className="textNodeExpandBackdrop" role="presentation" onClick={onClose}>
      <div
        className={`textNodeExpandPanel ${RF_NODE_INPUT_CLASS}`}
        role="dialog"
        aria-modal="true"
        aria-label="展开编辑"
        onClick={(e) => e.stopPropagation()}
        onWheel={onWheel}
      >
        <div className="textNodeExpandHead">
          <span className="textNodeExpandTitle">展开编辑</span>
          <button type="button" className="textNodeExpandBtn" onClick={onClose}>
            关闭
          </button>
        </div>
        <textarea
          className={`textNodeExpandTextarea mono ${RF_NODE_INPUT_CLASS}`}
          value={draft}
          maxLength={maxChars}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder="在此编辑正文…"
          rows={22}
          onWheel={onWheel}
        />
        <div className="textNodeExpandFoot">
          <button type="button" className="textNodeExpandBtn" onClick={onClose}>
            取消
          </button>
          <button type="button" className="textNodeExpandBtn textNodeExpandBtn--primary" onClick={onCommit}>
            保存
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
