/** 提交生成时追加的无字幕约束（不写入面板提示词原文） */
const NO_SUBTITLE_HINT =
  "画面中不要出现字幕、标题叠字、弹幕或水印式文字。";

/**
 * 在提交生成前为 prompt 追加无字幕描述；关闭开关时原样返回。
 */
export function applyNoSubtitlePrompt(prompt: string, enabled: boolean): string {
  const base = prompt.trim();
  if (!enabled) return base;
  if (!base) return NO_SUBTITLE_HINT;
  if (/无字幕|no subtitles?/i.test(base)) return base;
  return `${base}\n${NO_SUBTITLE_HINT}`;
}
