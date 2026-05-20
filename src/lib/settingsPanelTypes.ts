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
};

export type KeyPreviewItem = {
  masked: string;
  savedAt: string;
};
