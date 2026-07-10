import type { MouseEvent } from "react";
import {
  FmtHeadingLabel,
  IconHorizontalRule,
  IconUnorderedList,
} from "@/components/nodes/TextFormatToolbarIcons";

type Props = {
  onExec: (command: string, value?: string) => void;
  /** 顶栏内联：嵌入 textPreviewToolbar 胶囊内 */
  variant?: "shell" | "inline";
};

/** 文本格式按钮组：标题/正文 | 样式 | 列表 | 分割线 */
export function TextNodeFormatToolbar({ onExec, variant = "shell" }: Props) {
  const barClass =
    variant === "inline"
      ? "textNodeFormatBar textNodeFormatBar--inline"
      : "textNodeFormatBar";

  const preventBlur = (e: MouseEvent) => e.preventDefault();

  return (
    <div className={barClass} role="group" aria-label="文字排版">
      <button
        type="button"
        className="textNodeFmtBtn textNodeFmtBtn--heading"
        title="标题 1"
        aria-label="标题 1"
        onMouseDown={preventBlur}
        onClick={() => onExec("formatBlock", "h1")}
      >
        <FmtHeadingLabel level={1} />
      </button>
      <button
        type="button"
        className="textNodeFmtBtn textNodeFmtBtn--heading"
        title="标题 2"
        aria-label="标题 2"
        onMouseDown={preventBlur}
        onClick={() => onExec("formatBlock", "h2")}
      >
        <FmtHeadingLabel level={2} />
      </button>
      <button
        type="button"
        className="textNodeFmtBtn textNodeFmtBtn--heading"
        title="标题 3"
        aria-label="标题 3"
        onMouseDown={preventBlur}
        onClick={() => onExec("formatBlock", "h3")}
      >
        <FmtHeadingLabel level={3} />
      </button>
      <button
        type="button"
        className="textNodeFmtBtn textNodeFmtBtn--wide"
        title="正文"
        aria-label="正文"
        onMouseDown={preventBlur}
        onClick={() => onExec("formatBlock", "p")}
      >
        ¶
      </button>
      <span className="textNodeFmtSep" aria-hidden />
      <button
        type="button"
        className="textNodeFmtBtn textNodeFmtBtn--bold"
        title="加粗"
        aria-label="加粗"
        onMouseDown={preventBlur}
        onClick={() => onExec("bold")}
      >
        B
      </button>
      <button
        type="button"
        className="textNodeFmtBtn textNodeFmtBtn--italic"
        title="斜体"
        aria-label="斜体"
        onMouseDown={preventBlur}
        onClick={() => onExec("italic")}
      >
        I
      </button>
      <span className="textNodeFmtSep" aria-hidden />
      <button
        type="button"
        className="textNodeFmtBtn textNodeFmtBtn--icon"
        title="无序列表"
        aria-label="无序列表"
        onMouseDown={preventBlur}
        onClick={() => onExec("insertUnorderedList")}
      >
        <IconUnorderedList />
      </button>
      <button
        type="button"
        className="textNodeFmtBtn textNodeFmtBtn--icon textNodeFmtBtn--ol"
        title="有序列表"
        aria-label="有序列表"
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
        aria-label="分割线"
        onMouseDown={preventBlur}
        onClick={() => onExec("insertHorizontalRule")}
      >
        <IconHorizontalRule />
      </button>
    </div>
  );
}
