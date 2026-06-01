export type ProviderConfig = {
  id: string;
  label: string;
  baseUrl: string;
  model: string;
  priority: number;
  enabled: boolean;
};

export type ImageModelConfig = {
  id: string;
  vendorName: string;
  modelName: string;
  modelVariant: string;
  label: string;
  model: string;
  apiBaseUrl: string;
  enabled: boolean;
  priority: number;
  /** 为 false 时画布多图参考将降级为单张图生图 */
  supportsMultiRefFusion?: boolean;
  /** 参考图数量上限（1～4），默认 4 */
  maxReferenceImages?: number;
  /** 为 false 时 image_edit 阻断 */
  supportsImageEdit?: boolean;
};

/** 主题预设 */
export type AppThemePreset = "dark" | "dawn" | "day" | "dusk";

/** 光标样式 */
export type CursorStyle = "default" | "beam" | "crosshair" | "grab" | "text";

/** 节点排列方向 */
export type NodeDirection = "right" | "left" | "up" | "down";

/** 对齐辅助线触发模式 */
export type AlignFeatureTriggerMode = "click" | "hold" | "tab";

/** 选中节点高亮颜色 */
export type HighlightColor = "white" | "red" | "cyan" | "purple" | "blue" | "green" | "yellow";

/** 图片上传质量模式 */
export type UploadQualityMode = "high" | "standard" | "maximum";

export type AppSettings = {
  providers: ProviderConfig[];
  imageModels: ImageModelConfig[];
  videoModels: ImageModelConfig[];
  audioModels: ImageModelConfig[];
  defaultProviderId: string | null;
  ffmpegPath: string | null;
  /** 为 true 时任一节点失败即中止整图（默认 false：失败则跳过下游） */
  abortWorkflowOnFailure: boolean;
  /** 自定义 Hermes 用户记忆根目录；空则保存在各工程 `.canvasflow/hermes-knowledge-user/` */
  hermesMemoryRoot?: string | null;

  /** Hermes Agent：自动执行制片计划 */
  agentAutoExecute?: boolean;
  /** 大批量出图/出视频免「继续」确认 */
  agentAutoBatch?: boolean;
  agentAllowScriptEdit?: boolean;
  agentAllowMediaSubmit?: boolean;
  agentMaxConcurrentMedia?: number;
  /** 步内智能调整：缺图先出图、失败插入修复步 */
  agentLoopEnabled?: boolean;
  /** 长上下文 workstate 摘要用 LLM（iter-61） */
  agentLongContextLlmSummary?: boolean;
  /** 任务结束后 LLM 复盘（iter-73） */
  agentPostJobLlmReflect?: boolean;
  /** 灵体对失败/断链建议自动执行（需 agentAutoExecute） */
  agentProactiveRecovery?: boolean;

  /** 外接 MCP Server（stdio） */
  hermesMcpServers?: import("@/lib/hermes/agent/hermesExternalMcp").HermesMcpServerConfig[];

  // ── 外观 ──
  /** 主题预设（dark/dawn/day/dusk） */
  themePreset: AppThemePreset;
  /** 字号（small/medium/large） */
  fontSize: "small" | "medium" | "large";
  /** 光标样式 */
  cursorStyle: CursorStyle;
  /** 画布背景网格点 */
  gridDotsVisible: boolean;
  /** Prompt 操作表面跟随主题变色 */
  promptActionSurface: "themed" | "light" | "dark";

  // ── 节点行为 ──
  showVideoMeta: boolean;
  imageVideoNodeResizeEnabled: boolean;
  promptBoxResizeEnabled: boolean;
  titleFollowsCanvasZoom: boolean;
  /** 节点最小间距 */
  nodeSpacing: number;
  /** 节点排列方向 */
  nodeDirection: NodeDirection;
  nodeAvoidOverlap: boolean;

  // ── 画布对齐 ──
  selectionRelatedHighlightEnabled: boolean;
  selectionRelatedHighlightColor: HighlightColor;
  snapGuidesEnabled: boolean;
  connectionLinesVisible: boolean;
  snapGridEnabled: boolean;
  alignFeatureTriggerMode: AlignFeatureTriggerMode;
  alignDistributeGap: number;

  // ── 素材 ──
  uploadQuality: UploadQualityMode;

  /** 画布工程自动保存：编辑停顿多少秒后写入（0 = 关闭） */
  projectAutoSaveIdleSec?: number;
};

export type KeyPreviewItem = {
  masked: string;
  savedAt: string;
};
