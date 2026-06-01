/** 节点外置 Chrome 浮层 class（中性名 + 图片节点历史别名） */

export const NODE_CHROME_PANEL_CLASS = "nodeChrome--panel imageNodeChrome--minimal";
export const NODE_CHROME_TOP_CLASS = "nodeChrome--top imageNodeChrome--top";
export const NODE_CHROME_GEN_PANEL_CLASS = `${NODE_CHROME_PANEL_CLASS} imageGenPanel--minimal`;

/** 视频底栏：共用 Portal 皮肤，勿套用图片 180px 固定高 */
export const NODE_CHROME_VIDEO_PANEL_CLASS = `${NODE_CHROME_PANEL_CLASS} videoGenPanel--chrome`;

/** 文本底栏：模型对话 / 工作流面板 Portal */
export const NODE_CHROME_TEXT_PANEL_CLASS = `${NODE_CHROME_PANEL_CLASS} textNodeChrome--minimal`;

/** 音频底栏：文字转语音 ATP Portal */
export const NODE_CHROME_AUDIO_PANEL_CLASS = `${NODE_CHROME_PANEL_CLASS} audioNodeChrome--minimal audioTtsPanel--chrome`;

/** 脚本底栏：主题 prompt + 生成镜头 Portal（尺寸对标文本底栏，非图片 220px 壳） */
export const NODE_CHROME_SCRIPT_PANEL_CLASS = `${NODE_CHROME_TEXT_PANEL_CLASS} scriptNodeChrome--minimal`;

/** 视频合成底栏：对齐图片节点 500px Portal 皮肤 */
export const NODE_CHROME_FFMPEG_PANEL_CLASS = `${NODE_CHROME_PANEL_CLASS} ffmpegConcatPanel--chrome`;
