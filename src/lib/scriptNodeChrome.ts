/** 脚本节点 Chrome 壳尺寸（画布内随 zoom 缩放，对标文本预览壳） */

import {
  TEXT_NODE_CHROME_HEIGHT_EMPTY,
  TEXT_NODE_CHROME_WIDTH,
} from "@/lib/textNodeChrome";

export const SCRIPT_NODE_SHELL_WIDTH = TEXT_NODE_CHROME_WIDTH;
export const SCRIPT_NODE_MIN_HEIGHT_EMPTY = TEXT_NODE_CHROME_HEIGHT_EMPTY;
export const SCRIPT_MINI_PREVIEW_MAX_ROWS = 3;

/** 与文本节点一致：固定预览壳宽高，迷你表在壳内滚动 */
export function computeScriptNodeFrameSize(
  _hasBeats: boolean,
  _beatCount: number,
): { width: number; height: number } {
  return {
    width: SCRIPT_NODE_SHELL_WIDTH,
    height: SCRIPT_NODE_MIN_HEIGHT_EMPTY,
  };
}
