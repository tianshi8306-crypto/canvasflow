import {
  parseImagePromptInlineSegments,
  type ImagePromptInlineSegment,
} from "@/lib/imageGeneration/imagePromptAtTokens";
import type { ResolvedIncomingImageRef } from "@/lib/imageGeneration/types";
import {
  type PromptCharRange,
  collectNonTextTokenRanges,
  getAtomicTokenDeletionFromRanges,
  mapCursorAfterSegmentListReplace,
  mentionSegmentCharLength,
} from "@/lib/mentionInputEditing";

export type { PromptCharRange };

function asEditable(segments: ImagePromptInlineSegment[]) {
  return segments as Parameters<typeof collectNonTextTokenRanges>[0];
}

export function collectImagePromptTokenRanges(
  prompt: string,
  refs: ResolvedIncomingImageRef[],
  nodeLabels: Record<string, string> = {},
): PromptCharRange[] {
  return collectNonTextTokenRanges(
    asEditable(parseImagePromptInlineSegments(prompt, refs, nodeLabels)),
  );
}

export function getAtomicImagePromptTokenDeletion(
  prompt: string,
  cursor: number,
  selectionEnd: number,
  key: "Backspace" | "Delete",
  refs: ResolvedIncomingImageRef[],
  nodeLabels: Record<string, string> = {},
): PromptCharRange | null {
  return getAtomicTokenDeletionFromRanges(
    collectImagePromptTokenRanges(prompt, refs, nodeLabels),
    cursor,
    selectionEnd,
    key,
  );
}

export function mapImagePromptCursorAfterSegmentReplace(
  oldPrompt: string,
  newPrompt: string,
  cursor: number,
  refs: ResolvedIncomingImageRef[],
  nodeLabels: Record<string, string> = {},
): number {
  const oldSegs = parseImagePromptInlineSegments(oldPrompt, refs, nodeLabels);
  const newSegs = parseImagePromptInlineSegments(newPrompt, refs, nodeLabels);
  return mapCursorAfterSegmentListReplace(
    asEditable(oldSegs),
    asEditable(newSegs),
    cursor,
    newPrompt.length,
  );
}

export { mentionSegmentCharLength as segmentCharLength };
