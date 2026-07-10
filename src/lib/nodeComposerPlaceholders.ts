/**
 * 各节点底栏输入框 placeholder（灰色提示，不写入节点数据）。
 * 仅在节点实际支持 @ / 指令预设时写入对应提示。
 */

export type ComposerInputCaps = {
  /** @ 引用上游节点或参考条序号 */
  at?: boolean;
  /** / 呼出 Slash 指令预设面板 */
  slash?: boolean;
};

/** 拼接底栏灰色提示与 @ / 能力说明 */
export function buildComposerPlaceholder(base: string, caps: ComposerInputCaps = {}): string {
  const hintParts: string[] = [];
  if (caps.at) hintParts.push("@ 引用上游");
  if (caps.slash) hintParts.push("/ 呼出指令");
  const trimmed = base.trim().replace(/…+$/, "");
  if (hintParts.length === 0) return `${trimmed}…`;
  return `${trimmed}… ${hintParts.join("，")}`;
}

/** 文本节点 · 默认（模型对话） */
export const TEXT_COMPOSER_PLACEHOLDER_DEFAULT = buildComposerPlaceholder(
  "写下故事、场景或角色设定",
  { at: true },
);

/** 文本节点 · 图片反推（上游为图片连线，不用 @） */
export const TEXT_COMPOSER_PLACEHOLDER_IMAGE_TO_PROMPT =
  "根据图片生成结构化中文提示词（主体、环境、光影、镜头语言、风格关键词）";

/** 文本节点 · 文字生音乐 */
export const TEXT_COMPOSER_PLACEHOLDER_MUSIC = buildComposerPlaceholder(
  "描述音乐风格、情绪与乐器",
  { at: true },
);

/** 脚本节点 · 解析要求（体裁/集数/节奏可极简填写） */
export const SCRIPT_COMPOSER_PLACEHOLDER = buildComposerPlaceholder(
  "如：短剧、电影、广告、先输出第一集、快剪、慢节奏",
  { at: true, slash: true },
);

/** 图片节点 · 生图提示词 */
export function imageGenPromptPlaceholder(hasRefBar: boolean): string {
  if (hasRefBar) {
    return "描述画面与风格… @ 可写 @文本1、@图片1（序号与参考条一致），/ 呼出指令";
  }
  return buildComposerPlaceholder("描述画面、主体与风格", { at: true, slash: true });
}

/** 视频节点 · 画面描述（无 / 指令预设） */
export function videoGenPromptPlaceholder(hasIncomingRefs: boolean): string {
  if (hasIncomingRefs) {
    return "描述画面与动作… @ 可写 @文本1、@图片1（序号与参考条一致）";
  }
  return "描述画面、场景与动作…";
}

/** 音频节点 · TTS（纯文本输入，无 @ /） */
export const AUDIO_TTS_PLACEHOLDER = "输入要朗读的旁白或对白…";

/** LLM 卡片节点 */
export const LLM_PANEL_PLACEHOLDER = buildComposerPlaceholder("输入提示词，生成文本内容", {
  at: true,
  slash: true,
});

/** 剪辑节点 · 导出路径 */
export const FFMPEG_OUTPUT_PATH_PLACEHOLDER = "assets/exports/final.mp4";

/** 视频节点 · TTV 内联运镜提示（无 @ /） */
export const TTV_INLINE_CAMERA_PLACEHOLDER_PLAIN =
  "描述画面、镜头与风格… 生成结果将出现在视频节点中";
export const TTV_INLINE_CAMERA_PLACEHOLDER_FLOW =
  "描述画面、镜头与风格… 运镜标签与正文同一行，可拖动或 Alt+点击调整";
