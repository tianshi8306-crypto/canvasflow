/** 节点外置 Chrome 浮层 class（中性名 + 图片节点历史别名） */

export const NODE_CHROME_PANEL_CLASS = "nodeChrome--panel imageNodeChrome--minimal";
export const NODE_CHROME_TOP_CLASS = "nodeChrome--top imageNodeChrome--top";
export const NODE_CHROME_GEN_PANEL_CLASS = `${NODE_CHROME_PANEL_CLASS} imageGenPanel--minimal`;

/** 视频底栏：共用 Portal 皮肤，勿套用图片 180px 固定高 */
export const NODE_CHROME_VIDEO_PANEL_CLASS = `${NODE_CHROME_PANEL_CLASS} videoGenPanel--chrome`;

/** 文本底栏：模型对话 / 工作流面板 Portal */
export const NODE_CHROME_TEXT_PANEL_CLASS = `${NODE_CHROME_PANEL_CLASS} textNodeChrome--minimal`;
