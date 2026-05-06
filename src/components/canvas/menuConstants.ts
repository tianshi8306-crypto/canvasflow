import type { FlowCanvasMenuState } from "@/components/canvas/flowCanvasMenuState";

export const FLOW_MENU = {
  zIndex: 40,
  dropOverlayZIndex: 10,
  widths: {
    gallery: 300,
    context: 268,
    /** 空白处右键一级菜单（窄条） */
    contextPaneL1: 232,
    /** 空白处右键「添加节点」二级菜单；左键双击添加与之同宽 */
    contextPaneL2: 288,
  } as const,
  galleryListMaxHeight: 280,
  galleryPanelMaxHeight: 380,
  /** clamp 时预留的最大高度（实际菜单可能更小） */
  clampEstimatedHeight: 420,
} as const;

export function flowMenuWidth(state: FlowCanvasMenuState): number {
  if (state.mode === "add-panel" && state.addPanelTab === "gallery") {
    return FLOW_MENU.widths.gallery;
  }
  if (state.mode === "add-panel") {
    return FLOW_MENU.widths.contextPaneL2;
  }
  if (state.mode === "context-pane") {
    return state.paneAddSubmenu ? FLOW_MENU.widths.contextPaneL2 : FLOW_MENU.widths.contextPaneL1;
  }
  return FLOW_MENU.widths.context;
}
