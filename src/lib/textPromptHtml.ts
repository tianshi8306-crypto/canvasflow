import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import TurndownService from "turndown";
import { normalizeTextPromptMarkdown } from "@/lib/textPromptMarkdown";

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  emDelimiter: "*",
  strongDelimiter: "**",
  codeBlockStyle: "fenced",
});

turndown.addRule("preserveLineBreaks", {
  filter: ["br"],
  replacement: () => "\n",
});

/** Markdown → HTML（与预览排版共用，编辑态直接写入 contentEditable） */
export function markdownToHtml(markdown: string): string {
  const source = normalizeTextPromptMarkdown(markdown);
  if (!source.trim()) return "";
  // remark 对「**陈南：**」等含中文标点的加粗解析不完整，先转为 <strong>
  const withInlineStrong = source.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  return String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkBreaks)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeStringify, { allowDangerousHtml: true })
      .processSync(withInlineStrong),
  );
}

/** contentEditable HTML → Markdown */
export function htmlToMarkdown(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return "";
  const md = turndown.turndown(trimmed);
  return normalizeTextPromptMarkdown(md);
}
