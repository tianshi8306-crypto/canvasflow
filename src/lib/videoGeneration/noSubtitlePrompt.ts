/**
 * 提交生成时追加的无字幕约束（不写入面板提示词原文）
 *
 * 针对 Seedance / 即梦等中国 AI 视频生成平台优化：
 * - 前置负面约束，放在 prompt 最前面（模型对开头指令更敏感）
 * - 使用中英文双保险表述
 * - 增强视频自动去字幕的后处理可靠性
 */

const NO_SUBTITLE_HINT_CN =
  "【重要指令】本视频不包含任何形式的字幕、标题文字、弹幕、水印或文字滚动条，" +
  "画面中严禁出现任何中英文文本叠加层。";

const NO_SUBTITLE_HINT_EN =
  "IMPORTANT: No subtitles, captions, titles, watermarks, text overlays, " +
  "or scrolling text bars of any kind should appear in this video. The frame must be clean.";

/**
 * 在提交生成前为 prompt 追加无字幕描述；关闭开关时原样返回。
 *
 * 策略优化：
 * 1. 前置负面约束——放在 prompt 开头提高模型注意力
 * 2. 末尾追加英文备份——部分模型对英文指令响应更好
 * 3. 如果用户 prompt 中已明确写了"无字幕"相关指令则不再追加
 */
export function applyNoSubtitlePrompt(prompt: string, enabled: boolean): string {
  const base = prompt.trim();
  if (!enabled) return base;
  if (!base) return `${NO_SUBTITLE_HINT_CN}\n${NO_SUBTITLE_HINT_EN}`;
  if (/无字幕|no[\s-]*subtitles?/i.test(base)) return base;
  return `${NO_SUBTITLE_HINT_CN}\n\n${base}\n\n${NO_SUBTITLE_HINT_EN}`;
}
