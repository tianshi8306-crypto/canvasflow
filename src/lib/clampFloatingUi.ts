/** 将浮动面板左上坐标限制在视口内，避免菜单跑出屏幕 */
export function clampContextMenuPosition(
  clientX: number,
  clientY: number,
  panelWidth: number,
  maxPanelHeight: number,
  padding = 8,
): { x: number; y: number } {
  if (typeof window === "undefined") {
    return { x: clientX, y: clientY };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxX = Math.max(padding, vw - panelWidth - padding);
  const maxY = Math.max(padding, vh - maxPanelHeight - padding);
  let y = Math.min(Math.max(padding, clientY), maxY);
  // 防止估算高度偏小导致底部被裁切
  y = Math.min(y, Math.max(padding, vh - maxPanelHeight - padding));
  return {
    x: Math.min(Math.max(padding, clientX), maxX),
    y,
  };
}

type AnchorRect = { left: number; top: number; right: number; bottom: number; width: number };

/**
 * 锚定在触发元素上方（底栏控件专用）：用 bottom 定位，菜单向上生长，避免贴底时被裁切。
 */
export function anchorMenuAboveTrigger(
  rect: AnchorRect,
  menuWidth: number,
  gap = 8,
  padding = 8,
): { left: number; bottom: number } {
  if (typeof window === "undefined") {
    return { left: rect.left, bottom: gap };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const centerX = rect.left + rect.width / 2 - menuWidth / 2;
  const left = Math.min(Math.max(padding, centerX), Math.max(padding, vw - menuWidth - padding));
  const bottom = Math.max(padding, vh - rect.top + gap);
  return { left, bottom };
}
