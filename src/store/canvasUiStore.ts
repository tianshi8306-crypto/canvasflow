import { create } from "zustand";

/**
 * 画布级 UI：拖拽时收起展开态、音频右键 TTS、右键双击最大化等（与 projectStore 图数据分离）。
 */
type CanvasUiState = {
  /** 任意节点正在被拖拽时，所有节点显示「初始紧凑态」 */
  nodeDragSuppressUi: boolean;
  setNodeDragSuppressUi: (v: boolean) => void;

  /** 右键双击后全屏展示的节点 id */
  maximizedNodeId: string | null;
  setMaximizedNodeId: (id: string | null) => void;

  /** 音频节点：右键一次展开文字转语音面板 */
  audioTtsPanelNodeId: string | null;
  setAudioTtsPanelNodeId: (id: string | null) => void;

  /** 图片节点：从左锚点菜单触发「图生图」时，由目标节点拉起本机选图 */
  imageI2iTargetNodeId: string | null;
  setImageI2iTargetNodeId: (id: string | null) => void;

  /** 小地图显隐 */
  minimapVisible: boolean;
  setMinimapVisible: (v: boolean) => void;

  /** 画布视口交互中（缩放/平移手势期间），用于节点降级渲染 */
  viewportInteracting: boolean;
  setViewportInteracting: (v: boolean) => void;

  /** 拖拽节点时「相对其他节点」对齐吸附 */
  nodeSnapAlignmentEnabled: boolean;
  setNodeSnapAlignmentEnabled: (v: boolean) => void;

  /** 左下角「?」快捷键说明浮层 */
  shortcutsOverlayOpen: boolean;
  setShortcutsOverlayOpen: (v: boolean) => void;

  clearTransientUi: () => void;
};

export const useCanvasUiStore = create<CanvasUiState>((set) => ({
  nodeDragSuppressUi: false,
  setNodeDragSuppressUi: (v) => set({ nodeDragSuppressUi: v }),

  maximizedNodeId: null,
  setMaximizedNodeId: (id) => set({ maximizedNodeId: id }),

  audioTtsPanelNodeId: null,
  setAudioTtsPanelNodeId: (id) => set({ audioTtsPanelNodeId: id }),

  imageI2iTargetNodeId: null,
  setImageI2iTargetNodeId: (id) => set({ imageI2iTargetNodeId: id }),

  minimapVisible: true,
  setMinimapVisible: (v) => set({ minimapVisible: v }),

  viewportInteracting: false,
  setViewportInteracting: (v) =>
    set((state) => (state.viewportInteracting === v ? state : { viewportInteracting: v })),

  nodeSnapAlignmentEnabled: true,
  setNodeSnapAlignmentEnabled: (v) => set({ nodeSnapAlignmentEnabled: v }),

  shortcutsOverlayOpen: false,
  setShortcutsOverlayOpen: (v) => set({ shortcutsOverlayOpen: v }),

  clearTransientUi: () =>
    set({
      audioTtsPanelNodeId: null,
      imageI2iTargetNodeId: null,
    }),
}));
