import type { Connection, Edge, Node, NodeChange, Viewport } from "@xyflow/react";
import type { AlignOp, DistributeOp } from "@/lib/nodeAlignCommands";
import type { GroupColorToken } from "@/lib/canvasGroupColors";
import { newNodeDataByType } from "@/lib/canvasNodeDefaults";
import type { ComposeMissingShot } from "@/lib/compose";
import type { FlowNodeData } from "@/lib/types";
import type { VideoSubtitleRegion } from "@/lib/videoNodeTypes";
import type { NodeRunState } from "@/lib/runNodeState";

export type GraphSnapshot = {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  viewport: Viewport;
  /** 创建快照时的 graphRevision，用于 O(1) 比较是否有改动 */
  revision: number;
};

export type NodeDataPatchPayload = {
  nodeId: string;
  dataPatch: Partial<FlowNodeData>;
};

export type GraphRunWithPatchResult = {
  runId: string;
  nodePatches: NodeDataPatchPayload[];
};

export type ScriptComposeExportResult = {
  concatNodeId: string;
  clipPaths: string[];
  missing: ComposeMissingShot[];
  outputRelPath?: string;
  createdConcat: boolean;
};

export type ProjectState = {
  projectPath: string | null;
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  viewport: Viewport;
  selectedNodeId: string | null;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  lastSavedAt: number | null;
  /** 自上次保存以来画布有改动（自动保存前提示） */
  projectDirty: boolean;
  /** 画布图结构修订号：每次编辑 +1，用于撤销/保存防抖，避免整图 JSON 比较 */
  graphRevision: number;
  lastRunId: string | null;
  /** 最近一次成功返回 runId 的运行所记录的节点状态（执行工作流后由 run_events 填充） */
  nodeRunStateById: Record<string, NodeRunState>;
  /** 工作流执行中：锁定连线编辑（新增/删除/修改） */
  isGraphRunning: boolean;
  statusText: string;
  /** 画布内「复制节点」剪贴板中的节点数量（用于菜单灰显「粘贴」等） */
  flowClipboardCount: number;
  /** 脚本节点画布内「展开全屏」时对应的节点 id（与侧栏「全屏表格」共用） */
  scriptFullscreenNodeId: string | null;
  /** 当前激活的风格库预设 ID（null = 无风格约束） */
  activeStyleId: string | null;

  /** 图片节点序号计数器，每个工程独立（用于 "图片 1", "图片 2" ...） */
  imageNodeCounter: number;
  /** 获取并递增下一个图片节点序号标签 */
  nextImageNodeLabel: () => string;
  /** 视频节点序号计数器（用于 "视频 1", "视频 2" ...） */
  videoNodeCounter: number;
  /** 获取并递增下一个视频节点序号标签 */
  nextVideoNodeLabel: () => string;
  /** 文本节点序号计数器（用于 "文本 1", "文本 2" ...） */
  textNodeCounter: number;
  nextTextNodeLabel: () => string;
  /** 音频节点序号计数器（用于 "音频 1", "音频 2" ...） */
  audioNodeCounter: number;
  nextAudioNodeLabel: () => string;
  /** 脚本节点序号计数器（用于 "分镜脚本 1", "分镜脚本 2" ...） */
  scriptNodeCounter: number;
  nextScriptNodeLabel: () => string;

  setProjectPath: (p: string | null) => void;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedNodeIds: (ids: string[]) => void;
  setSelectedEdgeIds: (ids: string[]) => void;
  setStatusText: (t: string) => void;
  setViewport: (v: Viewport) => void;
  setActiveStyleId: (id: string | null) => void;
  openScriptFullscreen: (nodeId: string) => void;
  closeScriptFullscreen: () => void;
  setLastRunId: (runId: string) => void;

  onNodesChange: (changes: NodeChange<Node<FlowNodeData>>[]) => void;
  onEdgesChange: (changes: import("@xyflow/react").EdgeChange[]) => void;
  onConnect: (c: Connection) => void;

  /** 删除指定连线 */
  deleteEdge: (edgeId: string) => void;

  updateNodeData: (
    id: string,
    patch: Partial<FlowNodeData>,
    opts?: { silent?: boolean },
  ) => void;

  newProject: () => Promise<void>;
  openProject: () => Promise<void>;
  /** 打开指定目录（最近工程、路径直达） */
  openProjectAtPath: (folder: string) => Promise<void>;
  closeProject: () => Promise<void>;
  saveProject: () => Promise<void>;
  /** 另存为：选择新位置保存工程 */
  saveProjectAs: () => Promise<void>;
  runWorkflow: () => Promise<void>;
  /** 从指定节点起点触发子图执行（走 DAG 调度入口） */
  runNodeSubgraph: (fromNodeId: string, force?: boolean) => Promise<void>;
  /** 在组内子图上按入口依次执行 */
  runGroupSubgraph: (groupId: string, force?: boolean) => Promise<void>;
  /** 将组内媒体导出到工程 assets/export/ */
  exportGroupMedia: (groupId: string) => Promise<void>;
  /** 标记为分镜组并绑定脚本镜头范围 */
  convertGroupToStoryboard: (groupId: string) => void;
  /** 保存分组为工具箱模板 */
  saveGroupToToolbox: (groupId: string, name?: string) => Promise<void>;
  /** 设置组框色标 */
  setGroupColorToken: (groupId: string, token: GroupColorToken | null) => void;
  /** 组级 Hermes：组内补图节点并按策略批量出图 */
  runGroupHermesImages: (groupId: string) => Promise<void>;
  /** G7：复制整组（含嵌套子组、组内连线），偏移放置 */
  duplicateGroup: (groupId: string) => void;
  /** 从工具箱模板插入分组 */
  insertGroupTemplate: (
    templateId: string,
    worldPosition: { x: number; y: number },
    relPath?: string,
  ) => Promise<void>;
  /** 将当前选区保存为工作流（本机 / 工程库） */
  saveWorkflowFromSelection: (
    name: string,
    targets: { local: boolean; project: boolean },
    selectedNodeIds?: string[],
  ) => Promise<void>;
  /** 从工作流库插入 */
  insertWorkflow: (
    workflowId: string,
    worldPosition: { x: number; y: number },
    relPath?: string,
  ) => Promise<void>;
  /** 删除工作流（按来源） */
  deleteWorkflow: (
    workflowId: string,
    opts: { local?: boolean; relPath?: string },
  ) => Promise<void>;
  rerunFailedSubgraph: (force?: boolean) => Promise<void>;

  addNode: (node: Node<FlowNodeData>) => void;
  /** 一次添加多个节点与连线（单条撤销） */
  addNodesWithEdges: (newNodes: Node<FlowNodeData>[], newEdges: Edge[]) => void;
  /**
   * 在锚点水平方向创建新节点并联线（左=引入，右=引出）。
   * partnerType 为 canvasNodeDefaults 中注册的节点类型。
   */
  spawnAnchoredPartner: (args: {
    anchorNodeId: string;
    direction: "incoming" | "outgoing";
    partnerType: keyof typeof newNodeDataByType;
  }) => void;
  /**
   * 首尾帧工作流：在视频节点左侧补齐「首帧」「尾帧」图片节点并联线，
   * 并切换草稿为首尾帧模式、填入示例提示词（若提示词仍为空）。
   */
  setupFirstLastFrameForVideoNode: (videoNodeId: string) => void;
  /**
   * 首帧生成：在视频节点左侧添加「首帧」图片节点并联线，
   * 切换为全能参考模式并填入示例提示词（若提示词仍为空）。
   */
  setupFirstFrameVideoForVideoNode: (videoNodeId: string) => void;
  /**
   * 在视频节点左侧输入列添加图片 / 参考视频 / 参考音频节点并联线（输出仍在视频节点右侧）。
   */
  addInputNodeLeftOfVideo: (
    videoNodeId: string,
    kind: "image" | "referenceVideo" | "audio",
  ) => void;
  /** 从视频提取音轨到 assets，并在左侧新建音频节点并联线 */
  extractVideoAudioLeftOfNode: (
    videoNodeId: string,
    mode: "vocal" | "bgm",
  ) => Promise<void>;
  /** 在右侧创建/聚焦视频合成节点，用于多段剪辑拼接 */
  openVideoClipConcat: (videoNodeId: string) => Promise<void>;
  /** 按脚本镜号准备合成节点并可选自动 FFmpeg 导出成片 */
  exportScriptCompose: (
    scriptNodeId: string,
    opts?: {
      autoRender?: boolean;
      beatIds?: string[];
      exportFormat?: import("@/lib/compose/timelineExportFormat").TimelineExportFormat;
    },
  ) => Promise<ScriptComposeExportResult | null>;
  /** 顶栏「解析 / 高清 / 去字幕」：预填生成草稿并选中节点 */
  openVideoToolbarWorkflow: (
    videoNodeId: string,
    mode: "parse" | "hd" | "subtitle-auto",
  ) => void;
  /** 进入预览区单段裁剪模式 */
  enterVideoTrimMode: (videoNodeId: string) => void;
  /** 更新裁剪入出点（持久化到 data.video.sourceTrim） */
  patchVideoSourceTrim: (videoNodeId: string, trim: { inSec: number; outSec: number }) => void;
  /** 记录源视频时长与编码尺寸 */
  setVideoSourceMeta: (
    videoNodeId: string,
    meta: { durationSec: number; width: number; height: number },
  ) => void;
  /** 进入框选去字幕模式 */
  enterVideoSubtitleRegionMode: (videoNodeId: string) => void;
  /** 更新框选区域（持久化到 data.video.subtitleRegion） */
  patchVideoSubtitleRegion: (videoNodeId: string, region: VideoSubtitleRegion) => void;
  /** FFmpeg delogo 导出并替换节点成片 */
  exportVideoSubtitleDelogo: (videoNodeId: string) => Promise<void>;
  /** FFmpeg 导出裁剪片段并替换节点成片 */
  exportVideoTrim: (videoNodeId: string) => Promise<void>;
  /**
   * 图生图：将本机图片导入工程，在当前图片节点左侧新建图片节点并写入路径，再并联线。
   */
  addReferenceImageNodeLeftOf: (targetImageNodeId: string, filePaths: string[]) => Promise<void>;
  loadGraph: (nodes: Node<FlowNodeData>[], edges: Edge[], viewport: Viewport) => void;
  /** 切换画布 Tab 时恢复工程路径与图数据 */
  restoreCanvasTab: (args: {
    nodes: Node<FlowNodeData>[];
    edges: Edge[];
    viewport: Viewport;
    projectPath: string | null;
    projectDirty: boolean;
    statusText: string;
  }) => void;
  /** 平移/缩放画布结束时调用（每次手势结束一次），会记一次撤销点 */
  commitViewport: (vp: Viewport) => void;
  groupSelectedNodes: () => void;
  /** 解散选中的 group 节点，子节点还原为顶层坐标 */
  ungroupSelectedNodes: () => void;
  /** 程序化多选（同步节点 selected 标记） */
  selectNodesByIds: (ids: string[]) => void;
  /** 将选中顶层节点按宫格/水平/垂直排布；宫格支持指定列数（2/3/4） */
  arrangeSelectedNodes: (
    mode: "grid" | "horizontal" | "vertical",
    opts?: { gridCols?: 2 | 3 | 4 },
  ) => void;
  /** 整理画布：顶层节点宫格排列，返回移动的节点数 */
  tidyCanvasLayout: () => number;
  /** 方向键微调选中节点位置（px） */
  nudgeSelectedNodes: (dx: number, dy: number) => void;
  /** 相对选区外接矩形对齐（≥2 个未嵌套节点） */
  alignSelectedNodes: (op: AlignOp) => void;
  /** 水平/垂直等距分布（≥3 个未嵌套节点） */
  distributeSelectedNodes: (op: DistributeOp) => void;
  /** 将组内成员按宫格/水平/垂直排布（相对组坐标） */
  arrangeGroupMembers: (groupId: string, mode: "grid" | "horizontal" | "vertical") => void;
  importMediaFiles: (filePaths: string[], position?: { x: number; y: number }) => Promise<void>;
  /** 将本地文件导入工程 assets 并写入指定节点的 path（单条撤销） */
  assignImportedMediaToNode: (nodeId: string, filePaths: string[]) => Promise<void>;
  copySelection: () => void;
  pasteSelection: () => void;
  /** 创建试验分支：复制节点参数 + 上游入边，不复制下游 */
  createForkDuplicateOfSelection: () => void;
  deleteSelection: () => void;
  toggleSelectedEdgesDisabled: (disabled: boolean) => void;

  undo: () => void;
  redo: () => void;
};
