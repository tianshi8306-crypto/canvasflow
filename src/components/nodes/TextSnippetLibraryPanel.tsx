import { createPortal } from "react-dom";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";

type Props = {
  open: boolean;
  onClose: () => void;
};

/** F3 P0：工程级文本素材库占位（无读写） */
export function TextSnippetLibraryPanel({ open, onClose }: Props) {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="textSnippetLibraryBackdrop"
      role="presentation"
      onClick={onClose}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className={`textSnippetLibraryPanel ${RF_NODE_INPUT_CLASS}`}
        role="dialog"
        aria-modal="true"
        aria-label="文本素材库"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="textSnippetLibraryHead">
          <span className="textSnippetLibraryTitle">文本素材库</span>
          <button type="button" className="btn" onClick={onClose}>
            关闭
          </button>
        </div>
        <div className="textSnippetLibraryEmpty">
          <p className="textSnippetLibraryLead">工程级文本素材库即将支持</p>
          <p className="textSnippetLibraryHint">
            收藏常用文案（如 LOGO 标语、固定旁白）将保存在本工程的{" "}
            <code>assets/text-snippets/</code>，并可在图库中浏览与插入。
          </p>
          <p className="textSnippetLibraryHint textSnippetLibraryHint--muted">
            当前阶段为占位预览，暂无法保存或插入素材。
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
