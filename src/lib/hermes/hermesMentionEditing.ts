import { parseHermesMentionInlineSegments, type HermesMentionItem } from "@/lib/hermes/hermesMentionCatalog";
import {
  getAtomicTokenDeletionFromSegments,
  type PromptCharRange,
} from "@/lib/mentionInputEditing";

/** Hermes 对话：@素材名 / @图N 整段删除 */
export function getAtomicHermesMentionDeletion(
  prompt: string,
  cursor: number,
  selectionEnd: number,
  key: "Backspace" | "Delete",
  catalog: HermesMentionItem[],
): PromptCharRange | null {
  const segments = parseHermesMentionInlineSegments(prompt, catalog);
  return getAtomicTokenDeletionFromSegments(segments, cursor, selectionEnd, key);
}
