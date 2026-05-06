export type FlowCanvasMenuState = {
  x: number;
  y: number;
  mode: "add-panel" | "context-pane" | "context-node" | "context-edge";
  nodeId: string | null;
  edgeId?: string | null;
  /** 仅 mode === "add-panel" */
  addPanelTab?: "types" | "gallery";
  /** 仅 mode === "context-pane"：空白处右键「添加节点」二级面板 */
  paneAddSubmenu?: boolean;
};
