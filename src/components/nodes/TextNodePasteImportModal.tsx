import { createPortal } from "react-dom";
import type { WheelEvent as ReactWheelEvent } from "react";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";
import "./TextNodeChrome.css";

type Props = {
  open: boolean;
  target: "prompt" | "model";
  draft: string;
  maxChars: number;
  onDraftChange: (value: string) => void;
  onClose: () => void;
  onReadClipboard: () => void;
  onCommit: () => void;
  onWheel: (e: ReactWheelEvent) => void;
};

export function TextNodePasteImportModal({
  open,
  target,
  draft,
  maxChars,
  onDraftChange,
  onClose,
  onReadClipboard,
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
        aria-label="粘贴导入"
        onClick={(e) => e.stopPropagation()}
        onWheel={onWheel}
      >
        <div className="textNodeExpandHead">
          <span className="textNodeExpandTitle">
            {target === "model" ? "粘贴导入到模型对话输入" : "粘贴导入到正文"}
          </span>
          <button type="button" className="btn" onClick={onClose}>
            关闭
          </button>
        </div>
        <textarea
          className={`textNodeExpandTextarea mono ${RF_NODE_INPUT_CLASS}`}
          value={draft}
          maxLength={maxChars}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder="把文本粘贴到这里，然后点击“导入并追加”"
          rows={16}
          onWheel={onWheel}
        />
        <div className="textNodeExpandFoot" style={{ justifyContent: "space-between" }}>
          <button type="button" className="textNodeExpandBtn" onClick={onReadClipboard}>
            读取剪贴板
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="textNodeExpandBtn" onClick={onClose}>
              取消
            </button>
            <button type="button" className="textNodeExpandBtn textNodeExpandBtn--primary" onClick={onCommit}>
              导入并追加
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
