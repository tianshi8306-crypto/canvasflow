/** 文本节点预览正文以 Markdown 存储；纯文本与半结构化文本均会规范化。 */

const BOOK_TITLE_RE = /^《[^》]+》$/;
const SECTION_RE =
  /^(人物小传|故事梗概|剧情梗概|分镜设计|第一场|第[一二三四五六七八九十百\d]+集|[二三四五六七八九十百]+、)/;
const SCENE_SLUG_RE = /^\d+-\d+/;
const DIALOGUE_RE = /^[\u4e00-\u9fa5A-Za-z·]{1,12}：/;
const LABEL_RE =
  /^(外在|内在|形象|表演重点|场次|场景氛围|色调|镜头\s*\d*|人物|出场人物|时间|地点|道具|服装)/;
const HEADING_RE = /^#{1,6}\s+/;
const HR_RE = /^-{3,}\s*$/;
const FULL_BOLD_LINE_RE = /^\*\*[^*\n]+\*\*$/;

function stripBoldMarkers(text: string): string {
  return text.replace(/\*\*/g, "");
}

function enhancePlainLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) return "";

  if (HR_RE.test(trimmed)) return "---";
  if (HEADING_RE.test(trimmed)) return trimmed;

  const core = stripBoldMarkers(trimmed);

  if (BOOK_TITLE_RE.test(core)) return `# ${core}`;

  if (SECTION_RE.test(core) || /^第[一二三四五六七八九十百\d]+集/.test(core)) {
    return `## ${core.replace(/^#+\s*/, "")}`;
  }

  if (!/^[△▲]/.test(core) && SCENE_SLUG_RE.test(core)) {
    return `### ${core}`;
  }

  if (LABEL_RE.test(core)) {
    const idx = core.indexOf("：");
    if (idx > 0) {
      return `**${core.slice(0, idx + 1)}**${core.slice(idx + 1)}`;
    }
    return `**${core}**`;
  }

  if (DIALOGUE_RE.test(core)) {
    const idx = core.indexOf("：");
    const name = core.slice(0, idx);
    const rest = core.slice(idx + 1);
    return rest.trim() ? `**${name}：**${rest}` : `**${name}**`;
  }

  if (/^[\u4e00-\u9fa5A-Za-z·]{2,8}$/.test(core)) {
    return `**${core}**`;
  }

  if (/^[△▲]/.test(core)) return core;

  if (FULL_BOLD_LINE_RE.test(trimmed)) return trimmed;

  return core;
}

/**
 * 将 LLM/粘贴的剧本正文规范为可阅读的 Markdown（可写回 prompt，也可用于渲染）。
 * 逐行增强：已有标题行保留，纯文本行补结构，修复半套 ** 标记。
 */
export function normalizeTextPromptMarkdown(source: string): string {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];

  for (const rawLine of lines) {
    const enhanced = enhancePlainLine(rawLine);
    if (!enhanced) {
      if (out.length > 0 && out[out.length - 1] !== "") out.push("");
      continue;
    }

    if (enhanced.startsWith("## ") && out.length > 0) {
      let i = out.length - 1;
      while (i >= 0 && out[i] === "") i -= 1;
      const prev = i >= 0 ? out[i] : "";
      if (prev && prev !== "---" && !prev.startsWith("# ")) {
        out.push("---");
      }
    }

    out.push(enhanced);
  }

  return out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** @deprecated 使用 normalizeTextPromptMarkdown；渲染与存储共用同一规范化 */
export function prepareTextPromptMarkdown(source: string): string {
  return normalizeTextPromptMarkdown(source);
}

export type MarkdownFormatCommand =
  | "formatBlock:h1"
  | "formatBlock:h2"
  | "formatBlock:h3"
  | "formatBlock:p"
  | "bold"
  | "italic"
  | "insertUnorderedList"
  | "insertOrderedList"
  | "insertHorizontalRule"
  | "clearFormat";

function lineRange(text: string, cursor: number): { start: number; end: number } {
  const start = text.lastIndexOf("\n", Math.max(0, cursor - 1)) + 1;
  const nextNl = text.indexOf("\n", cursor);
  const end = nextNl === -1 ? text.length : nextNl;
  return { start, end };
}

function stripHeadingPrefix(line: string): string {
  return line.replace(/^#{1,6}\s+/, "");
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]*)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1");
}

function clearLineFormatting(line: string): string {
  return stripInlineMarkdown(
    stripHeadingPrefix(line).replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, ""),
  );
}

function prefixLine(text: string, cursor: number, prefix: string): { text: string; cursor: number } {
  const { start, end } = lineRange(text, cursor);
  const line = text.slice(start, end);
  const body = stripHeadingPrefix(line).replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "");
  const nextLine = `${prefix}${body}`;
  const nextText = text.slice(0, start) + nextLine + text.slice(end);
  const offset = nextLine.length - line.length;
  return { text: nextText, cursor: cursor + offset };
}

function wrapSelection(
  text: string,
  selStart: number,
  selEnd: number,
  before: string,
  after: string,
): { text: string; selStart: number; selEnd: number } {
  const selected = text.slice(selStart, selEnd);
  const wrapped = `${before}${selected || "文字"}${after}`;
  const nextText = text.slice(0, selStart) + wrapped + text.slice(selEnd);
  const nextStart = selStart + before.length;
  const nextEnd = nextStart + (selected || "文字").length;
  return { text: nextText, selStart: nextStart, selEnd: nextEnd };
}

export function applyMarkdownFormat(
  text: string,
  selStart: number,
  selEnd: number,
  command: string,
  value?: string,
): { text: string; selStart: number; selEnd: number } {
  const cursor = selStart;
  if (command === "formatBlock") {
    if (value === "h1") {
      const r = prefixLine(text, cursor, "# ");
      return { text: r.text, selStart: r.cursor, selEnd: r.cursor };
    }
    if (value === "h2") {
      const r = prefixLine(text, cursor, "## ");
      return { text: r.text, selStart: r.cursor, selEnd: r.cursor };
    }
    if (value === "h3") {
      const r = prefixLine(text, cursor, "### ");
      return { text: r.text, selStart: r.cursor, selEnd: r.cursor };
    }
    if (value === "p") {
      const r = prefixLine(text, cursor, "");
      return { text: r.text, selStart: r.cursor, selEnd: r.cursor };
    }
  }
  if (command === "bold") {
    return wrapSelection(text, selStart, selEnd, "**", "**");
  }
  if (command === "italic") {
    return wrapSelection(text, selStart, selEnd, "*", "*");
  }
  if (command === "insertUnorderedList") {
    const r = prefixLine(text, cursor, "- ");
    return { text: r.text, selStart: r.cursor, selEnd: r.cursor };
  }
  if (command === "insertOrderedList") {
    const r = prefixLine(text, cursor, "1. ");
    return { text: r.text, selStart: r.cursor, selEnd: r.cursor };
  }
  if (command === "insertHorizontalRule") {
    const insert = "\n\n---\n\n";
    const nextText = text.slice(0, selStart) + insert + text.slice(selEnd);
    const pos = selStart + insert.length;
    return { text: nextText, selStart: pos, selEnd: pos };
  }
  if (command === "clearFormat") {
    if (selStart !== selEnd) {
      const cleared = stripInlineMarkdown(text.slice(selStart, selEnd));
      const nextText = text.slice(0, selStart) + cleared + text.slice(selEnd);
      return { text: nextText, selStart, selEnd: selStart + cleared.length };
    }
    const { start, end } = lineRange(text, cursor);
    const line = text.slice(start, end);
    const nextLine = clearLineFormatting(line);
    const nextText = text.slice(0, start) + nextLine + text.slice(end);
    const offset = nextLine.length - line.length;
    return { text: nextText, selStart: cursor + offset, selEnd: cursor + offset };
  }
  return { text, selStart, selEnd };
}

export function applyMarkdownFormatToTextarea(
  textarea: HTMLTextAreaElement,
  command: string,
  value?: string,
): void {
  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? 0;
  const result = applyMarkdownFormat(textarea.value, start, end, command, value);
  textarea.value = result.text;
  textarea.setSelectionRange(result.selStart, result.selEnd);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}
