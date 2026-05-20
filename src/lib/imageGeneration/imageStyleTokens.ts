import {
  IMAGE_STYLE_OPTIONS,
  type ImageStyleId,
} from "@/lib/imageGeneration/catalog";

/** 画布提示词内嵌的风格标记，与 @ 引用并列展示 */
export const IMAGE_STYLE_TOKEN_RE = /#\[style:([a-z0-9_]+)\]/g;

const STYLE_ID_SET = new Set<ImageStyleId>(IMAGE_STYLE_OPTIONS.map((o) => o.id));

export function isImageStyleId(id: string): id is ImageStyleId {
  return STYLE_ID_SET.has(id as ImageStyleId);
}

export function imageStyleToken(styleId: ImageStyleId): string {
  return `#[style:${styleId}]`;
}

export function parseImageStyleIdsFromPrompt(prompt: string): ImageStyleId[] {
  const ids: ImageStyleId[] = [];
  const re = new RegExp(IMAGE_STYLE_TOKEN_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(prompt)) !== null) {
    const id = m[1];
    if (isImageStyleId(id) && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function stripImageStyleTokensFromPrompt(prompt: string): string {
  return prompt
    .replace(new RegExp(IMAGE_STYLE_TOKEN_RE.source, "g"), "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function toggleImageStyleInPrompt(
  prompt: string,
  styleId: ImageStyleId,
  enable: boolean,
): string {
  const token = imageStyleToken(styleId);
  if (enable) {
    if (prompt.includes(token)) return prompt;
    const trimmed = prompt.trimStart();
    return trimmed ? `${token} ${trimmed}` : token;
  }
  return prompt
    .replace(new RegExp(`#\\[style:${styleId}\\]\\s?`, "g"), "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export type PromptInlineSegment =
  | { kind: "text"; text: string }
  | { kind: "mention"; nodeId: string; label: string; token: string }
  | { kind: "style"; styleId: ImageStyleId; label: string; token: string };

const MENTION_RE = /@\[([^\]]+)\]/;
const STYLE_INLINE_RE = /#\[style:([a-z0-9_]+)\]/;

const styleLabelById = Object.fromEntries(
  IMAGE_STYLE_OPTIONS.map((o) => [o.id, o.label]),
) as Record<ImageStyleId, string>;

/** 按出现顺序解析 @ 引用与 # 风格内联标记，供 MentionInput 叠加层渲染 */
export function parsePromptInlineSegments(
  value: string,
  nodeLabels: Record<string, string>,
): PromptInlineSegment[] {
  const segments: PromptInlineSegment[] = [];
  let i = 0;
  while (i < value.length) {
    const rest = value.slice(i);
    const mentionMatch = rest.match(MENTION_RE);
    const styleMatch = rest.match(STYLE_INLINE_RE);
    const mentionAt = mentionMatch ? rest.indexOf(mentionMatch[0]) : -1;
    const styleAt = styleMatch ? rest.indexOf(styleMatch[0]) : -1;

    let nextAt = -1;
    let kind: "mention" | "style" | null = null;
    if (mentionAt >= 0 && (styleAt < 0 || mentionAt <= styleAt)) {
      nextAt = mentionAt;
      kind = "mention";
    } else if (styleAt >= 0) {
      nextAt = styleAt;
      kind = "style";
    }

    if (kind === null || nextAt < 0) {
      if (i < value.length) segments.push({ kind: "text", text: value.slice(i) });
      break;
    }

    if (nextAt > 0) {
      segments.push({ kind: "text", text: value.slice(i, i + nextAt) });
    }
    i += nextAt;

    if (kind === "mention" && mentionMatch) {
      const nodeId = mentionMatch[1];
      segments.push({
        kind: "mention",
        nodeId,
        label: nodeLabels[nodeId] ?? nodeId,
        token: mentionMatch[0],
      });
      i += mentionMatch[0].length;
    } else if (kind === "style" && styleMatch) {
      const styleId = styleMatch[1];
      if (isImageStyleId(styleId)) {
        segments.push({
          kind: "style",
          styleId,
          label: styleLabelById[styleId] ?? styleId,
          token: styleMatch[0],
        });
      } else {
        segments.push({ kind: "text", text: styleMatch[0] });
      }
      i += styleMatch[0].length;
    }
  }
  return segments;
}
