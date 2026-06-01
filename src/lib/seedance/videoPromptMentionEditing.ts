import {
  parseVideoPromptInlineSegments,
  type VideoPromptInlineSegment,
} from "@/lib/seedance/videoPromptAtTokens";
import type { NamedAsset } from "@/lib/seedance/promptBuilder";
import {
  type PromptCharRange,
  collectNonTextTokenRanges,
  getAtomicTokenDeletionFromRanges,
  mapCursorAfterSegmentListReplace,
  mentionSegmentCharLength,
} from "@/lib/mentionInputEditing";

export type { PromptCharRange };

function asEditable(segments: VideoPromptInlineSegment[]) {
  return segments as Parameters<typeof collectNonTextTokenRanges>[0];
}

/** 非纯文本片段在 prompt 中的字符区间（@图片N、@文件名、{{Portrait N}} 等） */
export function collectVideoPromptRefTokenRanges(
  prompt: string,
  namedAssets?: NamedAsset[],
): PromptCharRange[] {
  return collectNonTextTokenRanges(
    asEditable(parseVideoPromptInlineSegments(prompt, namedAssets)),
  );
}

export function getAtomicRefTokenDeletion(
  prompt: string,
  cursor: number,
  selectionEnd: number,
  key: "Backspace" | "Delete",
  namedAssets?: NamedAsset[],
): PromptCharRange | null {
  return getAtomicTokenDeletionFromRanges(
    collectVideoPromptRefTokenRanges(prompt, namedAssets),
    cursor,
    selectionEnd,
    key,
  );
}

/** blur 规范化后按片段映射光标，避免 token 变长/变短导致 caret 漂移 */
export function mapPromptCursorAfterSegmentReplace(
  oldPrompt: string,
  newPrompt: string,
  cursor: number,
  namedAssets?: NamedAsset[],
): number {
  const oldSegs = parseVideoPromptInlineSegments(oldPrompt, namedAssets);
  const newSegs = parseVideoPromptInlineSegments(newPrompt, namedAssets);
  return mapCursorAfterSegmentListReplace(
    asEditable(oldSegs),
    asEditable(newSegs),
    cursor,
    newPrompt.length,
  );
}

export { mentionSegmentCharLength as segmentCharLength };
