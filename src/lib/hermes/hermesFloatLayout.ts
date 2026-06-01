import {
  HERMES_FLOAT_HEIGHT,
  HERMES_FLOAT_WIDTH,
} from "@/lib/hermes/hermesShellPrefs";

/**
 * 浮窗固定 chrome 高度预算（px），与 `hermes-shell.css` 保持同步。
 * iter-110 起任务轨 ambient 化，浮窗内不再 inline Job peek。
 */
export const HERMES_FLOAT_CHROME_PX = {
  /** .hermesFloatHeader min-height 28 + padding 4×2 */
  header: 36,
  /** .hermesFloatComposer--lite + .hermesFloatInputPill--inline（单行） */
  composerLite: 58,
} as const;

/** 估算聊天滚动区高度（px） */
export function estimateHermesFloatChatHeightPx(): number {
  const body = HERMES_FLOAT_HEIGHT - HERMES_FLOAT_CHROME_PX.header;
  return Math.max(0, body - HERMES_FLOAT_CHROME_PX.composerLite);
}

/** 聊天区占浮窗总高度比例（0～1） */
export function hermesFloatChatHeightRatio(): number {
  return estimateHermesFloatChatHeightPx() / HERMES_FLOAT_HEIGHT;
}

export const HERMES_FLOAT_LAYOUT = {
  width: HERMES_FLOAT_WIDTH,
  height: HERMES_FLOAT_HEIGHT,
} as const;
