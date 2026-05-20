import { getSubjectById } from "@/lib/subjectStorage";
import { IMAGE_STYLE_PROMPTS, type ImageStyleId } from "@/lib/imageGeneration/catalog";

export function buildImagePromptWithSubject(
  basePrompt: string,
  subjectId?: string
): string {
  if (!subjectId) return basePrompt;
  const subject = getSubjectById(subjectId);
  if (!subject?.description?.trim()) return basePrompt;
  return `${basePrompt.trim()}\n\n主体特征：${subject.description.trim()}`;
}

/** 将已选画风描述词追加到 prompt 末尾 */
export function buildImagePromptWithStyles(
  basePrompt: string,
  styleIds: ImageStyleId[],
): string {
  const trimmed = basePrompt.trim();
  if (!styleIds.length) return trimmed;
  const styleText = styleIds.map((id) => IMAGE_STYLE_PROMPTS[id]).filter(Boolean).join(", ");
  if (!styleText) return trimmed;
  return `${trimmed}\n\nStyle: ${styleText}`;
}
