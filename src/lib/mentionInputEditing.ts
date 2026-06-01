/** 镜像 textarea + overlay 共用的 token 编辑工具（整段删除、光标映射） */

export type PromptCharRange = { start: number; end: number };

export type MentionEditableSegment =
  | { kind: "text"; text: string }
  | { kind: string; token: string; text?: never };

export function mentionSegmentCharLength(seg: MentionEditableSegment): number {
  if (seg.kind === "text") return seg.text?.length ?? 0;
  return (seg as { token: string }).token.length;
}

export function collectNonTextTokenRanges(
  segments: readonly MentionEditableSegment[],
): PromptCharRange[] {
  const ranges: PromptCharRange[] = [];
  let offset = 0;
  for (const seg of segments) {
    const len = mentionSegmentCharLength(seg);
    if (seg.kind !== "text") {
      ranges.push({ start: offset, end: offset + len });
    }
    offset += len;
  }
  return ranges;
}

/**
 * Backspace / Delete 时若光标落在 token 内或紧贴边界，则整段删除。
 * - Backspace：光标在 (start, end]
 * - Delete：光标在 [start, end)
 */
export function getAtomicTokenDeletionFromRanges(
  ranges: readonly PromptCharRange[],
  cursor: number,
  selectionEnd: number,
  key: "Backspace" | "Delete",
): PromptCharRange | null {
  if (cursor !== selectionEnd) return null;

  for (const { start, end } of ranges) {
    if (key === "Backspace" && cursor > start && cursor <= end) {
      return { start, end };
    }
    if (key === "Delete" && cursor >= start && cursor < end) {
      return { start, end };
    }
  }
  return null;
}

export function getAtomicTokenDeletionFromSegments(
  segments: readonly MentionEditableSegment[],
  cursor: number,
  selectionEnd: number,
  key: "Backspace" | "Delete",
): PromptCharRange | null {
  return getAtomicTokenDeletionFromRanges(
    collectNonTextTokenRanges(segments),
    cursor,
    selectionEnd,
    key,
  );
}

/** 片段列表替换后映射光标（blur 规范化、别名改写等） */
export function mapCursorAfterSegmentListReplace(
  oldSegs: readonly MentionEditableSegment[],
  newSegs: readonly MentionEditableSegment[],
  cursor: number,
  newPromptLength: number,
): number {
  const clamp = (n: number) => Math.max(0, Math.min(n, newPromptLength));
  if (oldSegs.length === 0) return clamp(cursor);

  let oldOff = 0;
  let newOff = 0;
  for (let i = 0; i < oldSegs.length; i++) {
    const os = oldSegs[i];
    const ns = newSegs[i];
    if (!ns) break;
    const oldLen = mentionSegmentCharLength(os);
    const newLen = mentionSegmentCharLength(ns);

    if (cursor <= oldOff) return clamp(newOff);
    if (cursor <= oldOff + oldLen) {
      const rel = cursor - oldOff;
      if (os.kind === "text" && ns.kind === "text") {
        return clamp(newOff + Math.min(rel, newLen));
      }
      if (os.kind !== "text" && ns.kind !== "text") {
        return clamp(newOff + Math.min(rel, newLen));
      }
      return clamp(newOff + newLen);
    }
    oldOff += oldLen;
    newOff += newLen;
  }
  return clamp(newPromptLength);
}

export function applyAtomicTokenDeletion(
  prompt: string,
  range: PromptCharRange,
): { value: string; cursor: number } {
  return {
    value: prompt.slice(0, range.start) + prompt.slice(range.end),
    cursor: range.start,
  };
}
