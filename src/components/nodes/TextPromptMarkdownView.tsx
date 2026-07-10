import { memo, useMemo } from "react";
import { markdownToHtml } from "@/lib/textPromptHtml";
import { normalizeTextPromptMarkdown } from "@/lib/textPromptMarkdown";
import "./TextPromptDocument.css";
type Props = {
  markdown: string;
  className?: string;
  /** 节点预览区：视口内渐隐截断（排版与全屏相同，仅可见区域更小） */
  clamp?: boolean;
};

export const TextPromptMarkdownView = memo(function TextPromptMarkdownView({
  markdown,
  className = "",
  clamp = false,
}: Props) {
  const prepared = useMemo(() => normalizeTextPromptMarkdown(markdown), [markdown]);
  const html = useMemo(() => markdownToHtml(prepared), [prepared]);
  const rootClass = [
    "textPromptDoc",
    clamp ? "textPromptDoc--clamp" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (!html) return null;

  return <div className={rootClass} dangerouslySetInnerHTML={{ __html: html }} />;
});