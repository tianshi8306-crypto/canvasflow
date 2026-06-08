import type { StylePreset } from "./types";
import { getStylePreset } from "./loader";

export function injectStyleIntoVideoPrompt(basePrompt: string, style: StylePreset): string {
  let p = basePrompt.trim();
  if (style.visualStyle) {
    p += `\n\nVisual Style: ${style.visualStyle}`;
  }
  if (style.negativePrompt) {
    p += `\n\nNegative Prompt: ${style.negativePrompt}`;
  }
  return p;
}

export function injectStyleIntoImagePrompt(
  basePrompt: string,
  style: StylePreset,
): { prompt: string; negativePrompt?: string } {
  const p = basePrompt.trim();
  return {
    prompt: style.visualStyle ? `${p}\n\n${style.visualStyle}` : p,
    negativePrompt: style.negativePrompt || undefined,
  };
}

/** 对视频 prompt 注入当前激活风格（如果激活）。内部处理加载和错误回退 */
export async function applyActiveStyleToVideoPrompt(
  activeStyleId: string | null,
  basePrompt: string,
): Promise<string> {
  if (!activeStyleId) return basePrompt;
  try {
    const { fetchStyleLibrary } = await import("./loader");
    const lib = await fetchStyleLibrary();
    const preset = getStylePreset(activeStyleId, lib);
    return preset ? injectStyleIntoVideoPrompt(basePrompt, preset) : basePrompt;
  } catch {
    return basePrompt;
  }
}

/** 对图片 prompt 注入当前激活风格（如果激活）。内部处理加载和错误回退 */
export async function applyActiveStyleToImagePrompt(
  activeStyleId: string | null,
  basePrompt: string,
  existingNegative?: string,
): Promise<{ prompt: string; negativePrompt?: string }> {
  if (!activeStyleId) return { prompt: basePrompt, negativePrompt: existingNegative };
  try {
    const { fetchStyleLibrary } = await import("./loader");
    const lib = await fetchStyleLibrary();
    const preset = getStylePreset(activeStyleId, lib);
    if (!preset) return { prompt: basePrompt, negativePrompt: existingNegative };
    const injected = injectStyleIntoImagePrompt(basePrompt, preset);
    return {
      prompt: injected.prompt,
      negativePrompt: injected.negativePrompt || existingNegative,
    };
  } catch {
    return { prompt: basePrompt, negativePrompt: existingNegative };
  }
}
