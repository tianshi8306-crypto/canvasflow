import type { FlowCanvasMenuState } from "@/components/canvas/flowCanvasMenuState";

/** 高于生成参数面板 Portal 层（--canvas-z-node-chrome），与风格浮层同层 */
export const CANVAS_CONTEXT_MENU_Z = 1300;

/** 整理画布确认条：高于右键/锚点菜单，画布内瞬时提示最高层 */
export const CANVAS_TIDY_CONFIRM_Z = 1500;

/**
 * 画布内浮动层 z-index（相对 `.canvasWrap` stacking context）。
 * 见 global.css `--canvas-z-*` 与 iteration-15-B。
 *
 * | 层 | 组件 | token |
 * |----|------|-------|
 * | 低 | Background、拖入遮罩 | dropOverlay |
 * | 中 | CanvasEmptyGuide（15-C） | emptyGuide |
 * | 中高 | MiniMap | minimap |
 * | 高 | leftAddDock、canvasBottomDock | dock |
 * | 更高 | Marker/Node/Multi 工具条 | toolbar |
 * | 菜单 | CanvasContextMenus、zoomMenu | menu（Portal 用 CANVAS_CONTEXT_MENU_Z） |
 */
export const CANVAS_Z = {
  dropOverlay: 10,
  emptyGuide: 5,
  returnToWork: 8,
  minimap: 10,
  pendingEdge: 11,
  selectionBounds: 12,
  dock: 20,
  zoomMenu: 21,
  tidyConfirm: 1500,
  projectPanel: 35,
  /** 单选节点顶/底栏 Portal 容器（见 canvasNodeChromePortal.ts） */
  nodeChrome: 28,
  toolbar: 30,
  connectHint: 130,
} as const;

export const FLOW_MENU = {
  zIndex: CANVAS_CONTEXT_MENU_Z,
  dropOverlayZIndex: CANVAS_Z.dropOverlay,
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
