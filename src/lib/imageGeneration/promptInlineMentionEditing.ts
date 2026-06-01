import { parsePromptInlineSegments } from "@/lib/imageGeneration/imageStyleTokens";
import {
  getAtomicTokenDeletionFromSegments,
  type PromptCharRange,
} from "@/lib/mentionInputEditing";

/** 图片/文本/脚本/LLM 面板：@[nodeId] 与 #[style:id] 整段删除 */
export function getAtomicPromptInlineDeletion(
  prompt: string,
  cursor: number,
  selectionEnd: number,
  key: "Backspace" | "Delete",
  nodeLabels: Record<string, string> = {},
): PromptCharRange | null {
  const segments = parsePromptInlineSegments(prompt, nodeLabels);
  return getAtomicTokenDeletionFromSegments(segments, cursor, selectionEnd, key);
}
