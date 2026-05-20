import type { MouseEvent } from "react";

type Props = {
  onExec: (command: string, value?: string) => void;
  /** 顶栏内联：去掉胶囊外壳，与 imagePreviewToolbar 并排 */
  variant?: "shell" | "inline";
};

/** 文本格式按钮组（Chrome C4：仅由顶栏引用，壳内不再浮动） */
export function TextNodeFormatToolbar({ onExec, variant = "shell" }: Props) {
  const barClass =
    variant === "inline"
      ? "textNodeFormatBar textNodeFormatBar--inline"
      : "textNodeFormatBar";

  const preventBlur = (e: MouseEvent) => e.preventDefault();

  return (
    <div className={barClass} role="toolbar" aria-label="文字排版">
      <button
        type="button"
        className="textNodeFmtBtn"
        title="标题 1"
        onMouseDown={preventBlur}
        onClick={() => onExec("formatBlock", "h1")}
      >
        H1
      </button>
      <button
        type="button"
        className="textNodeFmtBtn"
        title="标题 2"
        onMouseDown={preventBlur}
        onClick={() => onExec("formatBlock", "h2")}
      >
        H2
      </button>
      <button
        type="button"
        className="textNodeFmtBtn"
        title="标题 3"
        onMouseDown={preventBlur}
        onClick={() => onExec("formatBlock", "h3")}
      >
        H3
      </button>
      <span className="textNodeFmtSep" aria-hidden />
      <button
        type="button"
        className="textNodeFmtBtn textNodeFmtBtn--wide"
        title="正文"
        onMouseDown={preventBlur}
        onClick={() => onExec("formatBlock", "p")}
      >
        ¶
      </button>
      <span className="textNodeFmtSep" aria-hidden />
      <button
        type="button"
        className="textNodeFmtBtn"
        title="加粗"
        onMouseDown={preventBlur}
        onClick={() => onExec("bold")}
      >
        B
      </button>
      <button
        type="button"
        className="textNodeFmtBtn textNodeFmtBtn--italic"
        title="斜体"
        onMouseDown={preventBlur}
        onClick={() => onExec("italic")}
      >
        <span style={{ fontStyle: "italic" }}>I</span>
      </button>
      <span className="textNodeFmtSep" aria-hidden />
      <button
        type="button"
        className="textNodeFmtBtn textNodeFmtBtn--icon"
        title="无序列表"
        onMouseDown={preventBlur}
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
        onMouseDown={preventBlur}
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
        onMouseDown={preventBlur}
        onClick={() => onExec("insertHorizontalRule")}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M4 12h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
