type Props = {
  onExec: (command: string, value?: string) => void;
  onCopy: () => void;
  onPasteImport: () => void;
  onExpand: () => void;
};

/** 文本节点浮动排版条（自己编写 / 双击编辑共用） */
export function TextNodeFormatToolbar({ onExec, onCopy, onPasteImport, onExpand }: Props) {
  return (
    <div className="textNodeFormatBar" role="toolbar" aria-label="文字排版">
      <button
        type="button"
        className="textNodeFmtBtn"
        title="标题 1"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onExec("formatBlock", "h1")}
      >
        H1
      </button>
      <button
        type="button"
        className="textNodeFmtBtn"
        title="标题 2"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onExec("formatBlock", "h2")}
      >
        H2
      </button>
      <button
        type="button"
        className="textNodeFmtBtn"
        title="标题 3"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onExec("formatBlock", "h3")}
      >
        H3
      </button>
      <span className="textNodeFmtSep" aria-hidden />
      <button
        type="button"
        className="textNodeFmtBtn textNodeFmtBtn--wide"
        title="正文"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onExec("formatBlock", "p")}
      >
        ¶
      </button>
      <span className="textNodeFmtSep" aria-hidden />
      <button
        type="button"
        className="textNodeFmtBtn"
        title="加粗"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onExec("bold")}
      >
        B
      </button>
      <button
        type="button"
        className="textNodeFmtBtn textNodeFmtBtn--italic"
        title="斜体"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onExec("italic")}
      >
        <span style={{ fontStyle: "italic" }}>I</span>
      </button>
      <span className="textNodeFmtSep" aria-hidden />
      <button
        type="button"
        className="textNodeFmtBtn textNodeFmtBtn--icon"
        title="无序列表"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onExec("insertUnorderedList")}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="6" cy="7" r="1.5" fill="currentColor" />
          <circle cx="6" cy="12" r="1.5" fill="currentColor" />
          <circle cx="6" cy="17" r="1.5" fill="currentColor" />
          <path d="M10 7h10M10 12h10M10 17h7" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </button>
      <button
        type="button"
        className="textNodeFmtBtn textNodeFmtBtn--ol"
        title="有序列表"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onExec("insertOrderedList")}
      >
        <span className="textNodeFmtOlGlyph" aria-hidden>
          1.
          <br />
          2.
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M14 6h8M14 12h8M14 18h6" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </button>
      <span className="textNodeFmtSep" aria-hidden />
      <button
        type="button"
        className="textNodeFmtBtn textNodeFmtBtn--icon"
        title="分割线"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onExec("insertHorizontalRule")}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M4 12h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
      <span className="textNodeFmtSep" aria-hidden />
      <button
        type="button"
        className="textNodeFmtBtn textNodeFmtBtn--icon"
        title="复制内容"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => void onCopy()}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="8" y="8" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M5 5h11v11" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      </button>
      <span className="textNodeFmtSep" aria-hidden />
      <button
        type="button"
        className="textNodeFmtBtn textNodeFmtBtn--icon"
        title="粘贴导入"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onPasteImport}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M8 4h8v3H8z" stroke="currentColor" strokeWidth="1.4" />
          <rect x="6" y="7" width="12" height="13" rx="2" stroke="currentColor" strokeWidth="1.4" />
          <path d="M10 12h4M10 15h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
      <span className="textNodeFmtSep" aria-hidden />
      <button
        type="button"
        className="textNodeFmtBtn textNodeFmtBtn--icon"
        title="展开编辑"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onExpand}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M9 3H5v4M15 3h4v4M9 21H5v-4m10 4h4v-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
