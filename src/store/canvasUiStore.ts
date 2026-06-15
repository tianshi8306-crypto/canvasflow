import { create } from "zustand";
import type { Edge, Node, Viewport } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import type {
  AlignFeatureTriggerMode,
  HighlightColor,
  NodeDirection,
} from "@/lib/settingsPanelTypes";
import type { NodeSnapVisual } from "@/lib/nodeSnapAlignment";
import {
  loadHermesShellPrefs,
  saveHermesShellPrefs,
  type HermesFloatDock,
  type HermesOrbDock,
  type HermesShellMode,
} from "@/lib/hermes/hermesShellPrefs";
const initialHermesShell = loadHermesShellPrefs();

function persistHermesShell(get: () => CanvasUiState): void {
  const s = get();
  saveHermesShellPrefs({
    mode: "idle",
    panelWidth: s.hermesPanelWidth,
    orbDock: s.hermesOrbDock,
    floatDock: s.hermesFloatDock,
  });
}

/**
 * 画布级 UI：拖拽时收起展开态、音频右键 TTS、右键双击最大化等（与 projectStore 图数据分离）。
 */

export type AnchorDragConnectType = {
  nodeId: string;
  handleId: string;
  handleType: "source" | "target";
  side: "left" | "right";
  screenX: number;
  screenY: number;
} | null;

/** 拖线未连上目标时，在松手位置弹出锚点菜单 */
export type AnchorMenuRequest = {
  nodeId: string;
  direction: "incoming" | "outgoing";
  x: number;
  y: number;
} | null;

/** onConnectStart 记录，供 onConnectEnd 判断是否需要弹出菜单 */
export type AnchorConnectDrag = {
  nodeId: string;
  handleType: "source" | "target";
} | null;

/** 拖线松手在空白处：保持预览线直到选菜单项或取消 */
export type PendingAnchorConnection = {
  anchorNodeId: string;
  handleType: "source" | "target";
  releaseFlow: { x: number; y: number };
} | null;

export type CanvasTab = {
  id: string;
  name: string;
  projectPath: string | null;
  unsaved: boolean;
  /** 画布数据（切换时保存/恢复） */
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  viewport: Viewport;
};

const MAX_TABS = 20;

type CanvasUiState = {
  /** 任意节点正在被拖拽时，所有节点显示「初始紧凑态」 */
  nodeDragSuppressUi: boolean;
  setNodeDragSuppressUi: (v: boolean) => void;

  /** 是否有节点正在被拖拽（用于 CSS backdrop-filter 按需优化） */
  isNodeDragging: boolean;
  setIsNodeDragging: (v: boolean) => void;

  /** 右键双击后全屏展示的节点 id */
  maximizedNodeId: string | null;
  setMaximizedNodeId: (id: string | null) => void;

  /** 视频合成节点：全屏剪辑工作台 */
  composeEditorNodeId: string | null;
  setComposeEditorNodeId: (id: string | null) => void;

  /** 由画布外浮层请求视口定位到节点（FlowCanvas 内消费） */
  canvasFitRequestNodeId: string | null;
  requestCanvasFitToNode: (nodeId: string | null) => void;

  /** 图片节点：生成参数面板放大态（图一居中浮层） */
  imageGenPanelExpandedNodeId: string | null;
  setImageGenPanelExpandedNodeId: (id: string | null) => void;

  /** 图片节点：预览图放大态（LibTV 大图 lightbox） */
  imagePreviewExpandedNodeId: string | null;
  setImagePreviewExpandedNodeId: (id: string | null) => void;

  /** 视频节点：生成参数面板放大态 */
  videoGenPanelExpandedNodeId: string | null;
  setVideoGenPanelExpandedNodeId: (id: string | null) => void;

  /** 视频节点：预览成片放大态（LibTV lightbox） */
  videoPreviewExpandedNodeId: string | null;
  setVideoPreviewExpandedNodeId: (id: string | null) => void;

  /** 文本节点：钉住模型对话底栏 */
  textGenPanelPinnedNodeId: string | null;
  setTextGenPanelPinnedNodeId: (id: string | null) => void;

  /** 文本节点：模型对话面板放大态 */
  textGenPanelExpandedNodeId: string | null;
  setTextGenPanelExpandedNodeId: (id: string | null) => void;

  /** 脚本节点：钉住主题/生成底栏 */
  scriptGenPanelPinnedNodeId: string | null;
  setScriptGenPanelPinnedNodeId: (id: string | null) => void;

  /** 脚本节点：主题编辑面板放大态 */
  scriptGenPanelExpandedNodeId: string | null;
  setScriptGenPanelExpandedNodeId: (id: string | null) => void;

  /** 视频节点：预览区内单段裁剪编辑态 */
  videoTrimEditingNodeId: string | null;
  setVideoTrimEditingNodeId: (id: string | null) => void;

  /** 视频节点：预览区内框选去字幕编辑态 */
  videoSubtitleRegionEditingNodeId: string | null;
  setVideoSubtitleRegionEditingNodeId: (id: string | null) => void;

  /** 音频节点：用户打开 TTS 底栏（双击/右键/定位） */
  audioTtsPanelNodeId: string | null;
  setAudioTtsPanelNodeId: (id: string | null) => void;

  /** 音频节点：钉住 TTS 底栏 */
  audioTtsPanelPinnedNodeId: string | null;
  setAudioTtsPanelPinnedNodeId: (id: string | null) => void;

  /** 音频节点：TTS 面板放大态 */
  audioTtsPanelExpandedNodeId: string | null;
  setAudioTtsPanelExpandedNodeId: (id: string | null) => void;

  /** 图片节点：从左锚点菜单触发「图生图」时，由目标节点拉起本机选图 */
  imageI2iTargetNodeId: string | null;
  setImageI2iTargetNodeId: (id: string | null) => void;

  /** 标记的节点 id（用于画布导航：点击「返回节点」时定位到该节点） */
  markedNodeId: string | null;
  setMarkedNodeId: (id: string | null) => void;

  /** 脚本分镜聚焦：全屏创意视图 / 最大化 Overlay 分镜区滚动到指定镜头 */
  inspectorStoryboardFocus: { scriptNodeId: string; beatId: string } | null;
  setInspectorStoryboardFocus: (v: { scriptNodeId: string; beatId: string } | null) => void;

  /** 小地图显隐 */
  minimapVisible: boolean;
  setMinimapVisible: (v: boolean) => void;

  /** 主体列表版本号（每次主体创建/删除后 +1，ImageGenerationPanel 刷新下拉） */
  subjectListVersion: number;
  bumpSubjectListVersion: () => void;

  /** 画布视口交互中（缩放/平移手势期间），用于节点降级渲染 */
  viewportInteracting: boolean;
  setViewportInteracting: (v: boolean) => void;

  /** 拖拽节点时「相对其他节点」对齐吸附 */
  nodeSnapAlignmentEnabled: boolean;
  setNodeSnapAlignmentEnabled: (v: boolean) => void;

  /** 吸附生效时的水平参考线（flow 坐标） */
  nodeSnapVisual: NodeSnapVisual | null;
  setNodeSnapVisual: (v: NodeSnapVisual | null) => void;

  /** 选中元素高亮颜色 */
  selectionRelatedHighlightColor: HighlightColor;
  setSelectionRelatedHighlightColor: (v: HighlightColor) => void;

  /** 对齐辅助线开关 */
  snapGuidesEnabled: boolean;
  setSnapGuidesEnabled: (v: boolean) => void;

  /** 连接线显示开关 */
  connectionLinesVisible: boolean;
  setConnectionLinesVisible: (v: boolean) => void;

  /** 网格吸附开关 */
  snapGridEnabled: boolean;
  setSnapGridEnabled: (v: boolean) => void;

  /** 对齐特征触发模式 */
  alignFeatureTriggerMode: AlignFeatureTriggerMode;
  setAlignFeatureTriggerMode: (v: AlignFeatureTriggerMode) => void;

  /** 对齐分布间距 */
  alignDistributeGap: number;
  setAlignDistributeGap: (v: number) => void;

  /** 多选宫格默认列数（2/3/4） */
  multiSelectGridCols: 2 | 3 | 4;
  setMultiSelectGridCols: (v: 2 | 3 | 4) => void;

  /** 节点最小间距 */
  nodeSpacing: number;
  setNodeSpacing: (v: number) => void;

  /** 节点排列方向 */
  nodeDirection: NodeDirection;
  setNodeDirection: (v: NodeDirection) => void;

  /** 节点避障开关 */
  nodeAvoidOverlap: boolean;
  setNodeAvoidOverlap: (v: boolean) => void;

  /** 视频元数据显示 */
  showVideoMeta: boolean;
  setShowVideoMeta: (v: boolean) => void;

  /** 图片/视频节点缩放 */
  imageVideoNodeResizeEnabled: boolean;
  setImageVideoNodeResizeEnabled: (v: boolean) => void;

  /** Prompt 输入框缩放 */
  promptBoxResizeEnabled: boolean;
  setPromptBoxResizeEnabled: (v: boolean) => void;

  /** 标题跟随画布缩放 */
  titleFollowsCanvasZoom: boolean;
  setTitleFollowsCanvasZoom: (v: boolean) => void;

  /** 主题预设 */
  themePreset: "dark" | "light";
  setThemePreset: (v: "dark" | "light") => void;

  /** 字号 */
  fontSize: "small" | "medium" | "large";
  setFontSize: (v: "small" | "medium" | "large") => void;

  /** 光标样式 */
  cursorStyle: "default" | "beam" | "crosshair" | "grab" | "text";
  setCursorStyle: (v: "default" | "beam" | "crosshair" | "grab" | "text") => void;

  /** 网格点可见性 */
  gridDotsVisible: boolean;
  setGridDotsVisible: (v: boolean) => void;

  /** 左下角「?」快捷键说明浮层 */
  shortcutsOverlayOpen: boolean;
  setShortcutsOverlayOpen: (v: boolean) => void;

  /** Tab 等快捷键请求在视口坐标打开「添加」面板（由 FlowCanvas 消费） */
  pendingAddPanelAt: { x: number; y: number } | null;
  queueAddPanelAt: (x: number, y: number) => void;
  clearPendingAddPanelAt: () => void;

  /** 空画布引导已关闭（双击空白打开添加面板等，与是否已添加节点无关） */
  emptyGuideDismissed: boolean;
  dismissEmptyGuide: () => void;
  resetEmptyGuide: () => void;

  /** @deprecated 保留兼容；新逻辑用 anchorConnectDrag + anchorMenuRequest */
  anchorDragConnect: AnchorDragConnectType;
  setAnchorDragConnect: (v: AnchorDragConnectType) => void;

  anchorMenuRequest: AnchorMenuRequest;
  setAnchorMenuRequest: (v: AnchorMenuRequest) => void;
  /** 避免 connectEnd 与 click 连续弹出两次菜单 */
  anchorMenuOpenedAt: number;
  /** 递增后通知各节点收起本地锚点菜单 */
  anchorMenuDismissEpoch: number;
  bumpAnchorMenuDismiss: () => void;

  anchorConnectDrag: AnchorConnectDrag;
  setAnchorConnectDrag: (v: AnchorConnectDrag) => void;

  pendingAnchorConnection: PendingAnchorConnection;
  setPendingAnchorConnection: (v: PendingAnchorConnection) => void;

  /** 左侧项目面板显隐 */
  projectPanelOpen: boolean;
  setProjectPanelOpen: (v: boolean) => void;

  /** 多画布标签页 */
  tabs: CanvasTab[];
  activeTabId: string | null;
  addTab: (tab: Omit<CanvasTab, "id">) => boolean;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, patch: Partial<CanvasTab>) => void;
  updateTabUnsaved: (id: string, unsaved: boolean) => void;

  /** 内置 Hermes Shell（Phase A：仅 UI） */
  hermesMode: HermesShellMode;
  hermesPanelWidth: number;
  hermesOrbDock: HermesOrbDock;
  hermesFloatDock: HermesFloatDock;
  expandHermes: () => void;
  collapseHermes: () => void;
  toggleHermes: () => void;
  setHermesOrbDock: (dock: HermesOrbDock) => void;
  setHermesFloatDock: (dock: HermesFloatDock) => void;
  /** 展开侧栏并预填输入框（Orb 主动建议） */
  hermesComposerSeed: string | null;
  setHermesComposerSeed: (text: string | null) => void;
  expandHermesWithPrompt: (prompt: string) => void;

  /** Ambient 制片任务抽屉（iter-110） */
  hermesJobDrawerOpen: boolean;
  openHermesJobDrawer: () => void;
  closeHermesJobDrawer: () => void;
  toggleHermesJobDrawer: () => void;

  /** 确认对话框 */
  confirmDialog: {
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmLabel?: string;
    saveLabel?: string;
    onSave?: () => void | Promise<void>;
  } | null;
  openConfirmDialog: (opts: {
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmLabel?: string;
    saveLabel?: string;
    onSave?: () => void | Promise<void>;
  }) => void;
  closeConfirmDialog: () => void;

  /** 保存工作流对话框 */
  saveWorkflowDialogOpen: boolean;
  openSaveWorkflowDialog: () => void;
  closeSaveWorkflowDialog: () => void;

  /** E2：脚本/分镜版本可视化对比 */
  scriptVersionDiffOpen: boolean;
  scriptVersionDiffPreset: {
    olderVersionId?: string;
    newerVersionId?: string;
  } | null;
  openScriptVersionDiff: (opts?: {
    olderVersionId?: string;
    newerVersionId?: string;
  }) => void;
  closeScriptVersionDiff: () => void;

  /** 首次安装引导 */
  onboardingGuideOpen: boolean;
  openOnboardingGuide: () => void;
  closeOnboardingGuide: () => void;

  clearTransientUi: () => void;
};

export const useCanvasUiStore = create<CanvasUiState>((set, get) => ({
  nodeDragSuppressUi: false,
  setNodeDragSuppressUi: (v) => set({ nodeDragSuppressUi: v }),
  isNodeDragging: false,
  setIsNodeDragging: (v) => set({ isNodeDragging: v }),

  maximizedNodeId: null,
  setMaximizedNodeId: (id) => set({ maximizedNodeId: id }),

  composeEditorNodeId: null,
  setComposeEditorNodeId: (id) => set({ composeEditorNodeId: id }),

  canvasFitRequestNodeId: null,
  requestCanvasFitToNode: (nodeId) => set({ canvasFitRequestNodeId: nodeId }),

  imageGenPanelExpandedNodeId: null,
  setImageGenPanelExpandedNodeId: (id) => set({ imageGenPanelExpandedNodeId: id }),

  imagePreviewExpandedNodeId: null,
  setImagePreviewExpandedNodeId: (id) => set({ imagePreviewExpandedNodeId: id }),

  videoGenPanelExpandedNodeId: null,
  setVideoGenPanelExpandedNodeId: (id) => set({ videoGenPanelExpandedNodeId: id }),

  videoPreviewExpandedNodeId: null,
  setVideoPreviewExpandedNodeId: (id) => set({ videoPreviewExpandedNodeId: id }),

  textGenPanelPinnedNodeId: null,
  setTextGenPanelPinnedNodeId: (id) => set({ textGenPanelPinnedNodeId: id }),

  textGenPanelExpandedNodeId: null,
  setTextGenPanelExpandedNodeId: (id) => set({ textGenPanelExpandedNodeId: id }),

  scriptGenPanelPinnedNodeId: null,
  setScriptGenPanelPinnedNodeId: (id) => set({ scriptGenPanelPinnedNodeId: id }),

  scriptGenPanelExpandedNodeId: null,
  setScriptGenPanelExpandedNodeId: (id) => set({ scriptGenPanelExpandedNodeId: id }),

  videoTrimEditingNodeId: null,
  setVideoTrimEditingNodeId: (id) => set({ videoTrimEditingNodeId: id }),

  videoSubtitleRegionEditingNodeId: null,
  setVideoSubtitleRegionEditingNodeId: (id) => set({ videoSubtitleRegionEditingNodeId: id }),

  audioTtsPanelNodeId: null,
  setAudioTtsPanelNodeId: (id) => set({ audioTtsPanelNodeId: id }),

  audioTtsPanelPinnedNodeId: null,
  setAudioTtsPanelPinnedNodeId: (id) => set({ audioTtsPanelPinnedNodeId: id }),

  audioTtsPanelExpandedNodeId: null,
  setAudioTtsPanelExpandedNodeId: (id) => set({ audioTtsPanelExpandedNodeId: id }),

  imageI2iTargetNodeId: null,
  setImageI2iTargetNodeId: (id) => set({ imageI2iTargetNodeId: id }),

  markedNodeId: null,
  setMarkedNodeId: (id) => set({ markedNodeId: id }),

  inspectorStoryboardFocus: null,
  setInspectorStoryboardFocus: (v) => set({ inspectorStoryboardFocus: v }),

  minimapVisible: false,
  setMinimapVisible: (v) => set({ minimapVisible: v }),

  subjectListVersion: 0,
  bumpSubjectListVersion: () => set((s) => ({ subjectListVersion: s.subjectListVersion + 1 })),

  viewportInteracting: false,
  setViewportInteracting: (v) =>
    set((state) => (state.viewportInteracting === v ? state : { viewportInteracting: v })),

  nodeSnapAlignmentEnabled: true,
  setNodeSnapAlignmentEnabled: (v) => set({ nodeSnapAlignmentEnabled: v }),

  nodeSnapVisual: null,
  setNodeSnapVisual: (v) => set({ nodeSnapVisual: v }),

  selectionRelatedHighlightColor: "white",
  setSelectionRelatedHighlightColor: (v) => set({ selectionRelatedHighlightColor: v }),

  snapGuidesEnabled: true,
  setSnapGuidesEnabled: (v) => set({ snapGuidesEnabled: v }),

  connectionLinesVisible: true,
  setConnectionLinesVisible: (v) => set({ connectionLinesVisible: v }),

  snapGridEnabled: false,
  setSnapGridEnabled: (v) => set({ snapGridEnabled: v }),

  alignFeatureTriggerMode: "click",
  setAlignFeatureTriggerMode: (v) => set({ alignFeatureTriggerMode: v }),

  alignDistributeGap: 40,
  setAlignDistributeGap: (v) => set({ alignDistributeGap: v }),

  multiSelectGridCols: 3,
  setMultiSelectGridCols: (v) => set({ multiSelectGridCols: v }),

  nodeSpacing: 120,
  setNodeSpacing: (v) => set({ nodeSpacing: v }),

  nodeDirection: "right",
  setNodeDirection: (v) => set({ nodeDirection: v }),

  nodeAvoidOverlap: true,
  setNodeAvoidOverlap: (v) => set({ nodeAvoidOverlap: v }),

  showVideoMeta: true,
  setShowVideoMeta: (v) => set({ showVideoMeta: v }),

  imageVideoNodeResizeEnabled: true,
  setImageVideoNodeResizeEnabled: (v) => set({ imageVideoNodeResizeEnabled: v }),

  promptBoxResizeEnabled: true,
  setPromptBoxResizeEnabled: (v) => set({ promptBoxResizeEnabled: v }),

  titleFollowsCanvasZoom: true,
  setTitleFollowsCanvasZoom: (v) => set({ titleFollowsCanvasZoom: v }),

  themePreset: "dark",
  setThemePreset: (v) => set({ themePreset: v }),

  fontSize: "medium",
  setFontSize: (v) => set({ fontSize: v }),

  cursorStyle: "default",
  setCursorStyle: (v) => set({ cursorStyle: v }),

  gridDotsVisible: true,
  setGridDotsVisible: (v) => set({ gridDotsVisible: v }),

  shortcutsOverlayOpen: false,
  setShortcutsOverlayOpen: (v) => set({ shortcutsOverlayOpen: v }),

  pendingAddPanelAt: null,
  queueAddPanelAt: (x, y) => set({ pendingAddPanelAt: { x, y } }),
  clearPendingAddPanelAt: () => set({ pendingAddPanelAt: null }),

  emptyGuideDismissed: false,
  dismissEmptyGuide: () => set({ emptyGuideDismissed: true }),
  resetEmptyGuide: () => set({ emptyGuideDismissed: false }),

  anchorDragConnect: null,
  setAnchorDragConnect: (v) => set({ anchorDragConnect: v }),

  anchorMenuRequest: null,
  anchorMenuOpenedAt: 0,
  anchorMenuDismissEpoch: 0,
  bumpAnchorMenuDismiss: () =>
    set((s) => ({ anchorMenuDismissEpoch: s.anchorMenuDismissEpoch + 1 })),
  setAnchorMenuRequest: (v) =>
    set({
      anchorMenuRequest: v,
      anchorMenuOpenedAt: v ? Date.now() : get().anchorMenuOpenedAt,
    }),

  anchorConnectDrag: null,
  setAnchorConnectDrag: (v) => set({ anchorConnectDrag: v }),

  pendingAnchorConnection: null,
  setPendingAnchorConnection: (v) => set({ pendingAnchorConnection: v }),

  projectPanelOpen: false,
  setProjectPanelOpen: (v) => set({ projectPanelOpen: v }),

  tabs: [],
  activeTabId: null,

  addTab: (tab) => {
    const { tabs } = get();
    if (tabs.length >= MAX_TABS) return false;
    const id = crypto.randomUUID();
    set({ tabs: [...tabs, { ...tab, id }], activeTabId: id });
    return true;
  },

  removeTab: (id) => {
    const { tabs, activeTabId } = get();
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const newTabs = tabs.filter((t) => t.id !== id);
    let newActiveId = activeTabId;
    if (activeTabId === id) {
      newActiveId = newTabs.length > 0 ? newTabs[Math.min(idx, newTabs.length - 1)].id : null;
    }
    set({ tabs: newTabs, activeTabId: newActiveId });
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  updateTab: (id, patch) => {
    const { tabs } = get();
    const tab = tabs.find((t) => t.id === id);
    if (!tab) return;
    const next = { ...tab, ...patch };
    const same =
      next.name === tab.name &&
      next.projectPath === tab.projectPath &&
      next.unsaved === tab.unsaved &&
      next.nodes === tab.nodes &&
      next.edges === tab.edges &&
      next.viewport.x === tab.viewport.x &&
      next.viewport.y === tab.viewport.y &&
      next.viewport.zoom === tab.viewport.zoom;
    if (same) return;
    set({ tabs: tabs.map((t) => (t.id === id ? next : t)) });
  },

  updateTabUnsaved: (id, unsaved) => {
    const { tabs } = get();
    const tab = tabs.find((t) => t.id === id);
    if (!tab || tab.unsaved === unsaved) return;
    set({ tabs: tabs.map((t) => (t.id === id ? { ...t, unsaved } : t)) });
  },

  hermesMode: initialHermesShell.mode,
  hermesPanelWidth: initialHermesShell.panelWidth,
  hermesOrbDock: initialHermesShell.orbDock,
  hermesFloatDock: initialHermesShell.floatDock,
  hermesComposerSeed: null,
  hermesJobDrawerOpen: false,

  expandHermes: () => {
    set({ hermesMode: "expanded" });
    persistHermesShell(get);
  },

  setHermesComposerSeed: (text) => set({ hermesComposerSeed: text }),

  expandHermesWithPrompt: (prompt) => {
    set({ hermesMode: "expanded", hermesComposerSeed: prompt.trim() || null });
    persistHermesShell(get);
  },

  collapseHermes: () => {
    set({
      hermesMode: "idle",
      hermesComposerSeed: null,
      hermesJobDrawerOpen: false,
    });
    persistHermesShell(get);
  },

  openHermesJobDrawer: () => set({ hermesJobDrawerOpen: true }),
  closeHermesJobDrawer: () => set({ hermesJobDrawerOpen: false }),
  toggleHermesJobDrawer: () =>
    set((s) => ({ hermesJobDrawerOpen: !s.hermesJobDrawerOpen })),

  toggleHermes: () => {
    set((s) => ({ hermesMode: s.hermesMode === "expanded" ? "idle" : "expanded" }));
    persistHermesShell(get);
  },

  setHermesOrbDock: (orbDock) => {
    set({ hermesOrbDock: orbDock });
  },

  setHermesFloatDock: (floatDock) => {
    set({ hermesFloatDock: floatDock });
    persistHermesShell(get);
  },

  confirmDialog: null,

  openConfirmDialog: (opts) => {
    set({
      confirmDialog: {
        open: true,
        title: opts.title,
        message: opts.message,
        onConfirm: opts.onConfirm,
        onCancel: opts.onCancel ?? (() => {}),
        confirmLabel: opts.confirmLabel,
        saveLabel: opts.saveLabel,
        onSave: opts.onSave,
      },
    });
  },

  closeConfirmDialog: () => {
    set({ confirmDialog: null });
  },

  saveWorkflowDialogOpen: false,
  openSaveWorkflowDialog: () => set({ saveWorkflowDialogOpen: true }),
  closeSaveWorkflowDialog: () => set({ saveWorkflowDialogOpen: false }),

  scriptVersionDiffOpen: false,
  scriptVersionDiffPreset: null,
  openScriptVersionDiff: (opts) =>
    set({
      scriptVersionDiffOpen: true,
      scriptVersionDiffPreset: opts ?? null,
    }),
  closeScriptVersionDiff: () =>
    set({ scriptVersionDiffOpen: false, scriptVersionDiffPreset: null }),

  onboardingGuideOpen: false,
  openOnboardingGuide: () => set({ onboardingGuideOpen: true }),
  closeOnboardingGuide: () => set({ onboardingGuideOpen: false }),

  clearTransientUi: () =>
    set({
      audioTtsPanelNodeId: null,
      audioTtsPanelPinnedNodeId: null,
      audioTtsPanelExpandedNodeId: null,
      imageI2iTargetNodeId: null,
      imageGenPanelExpandedNodeId: null,
      imagePreviewExpandedNodeId: null,
      videoGenPanelExpandedNodeId: null,
      videoPreviewExpandedNodeId: null,
      textGenPanelPinnedNodeId: null,
      textGenPanelExpandedNodeId: null,
      scriptGenPanelPinnedNodeId: null,
      scriptGenPanelExpandedNodeId: null,
      videoTrimEditingNodeId: null,
      videoSubtitleRegionEditingNodeId: null,
      composeEditorNodeId: null,
      canvasFitRequestNodeId: null,
      nodeSnapVisual: null,
    }),
}));
