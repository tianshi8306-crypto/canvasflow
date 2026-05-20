import type { CSSProperties } from "react";

/** 指针落在菜单左上角时的偏移（菜单出现在指针右下方） */
export const ANCHOR_MENU_CURSOR_OFFSET_PX = 8;

export function anchorMenuPositionStyle(clientX: number, clientY: number): CSSProperties {
  return {
    position: "fixed",
    left: clientX + ANCHOR_MENU_CURSOR_OFFSET_PX,
    top: clientY + ANCHOR_MENU_CURSOR_OFFSET_PX,
    transform: "none",
    zIndex: 120,
  };
}
