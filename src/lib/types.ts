import type { Edge, Node, Viewport } from "@xyflow/react";
import type { ComposeTimelineClip } from "@/lib/compose/timelineClips";
import type { VideoNodePersisted } from "@/lib/videoNodeTypes";

export type ScriptRole = {
  id: string;
  name: string;
  description: string;
  imagePath: string;
  /** 角色参考图素材 ID（与 imagePath 双写，M3） */
  imageAssetId?: string;
  reference: string;
  action: string;
  emotion: string;
  lines: string;
};

/** 脚本节点集级节奏报告 */
export type ScriptRhythmReport = {
  totalDurationSec?: number;
  shotCount?: number;
  closeUpRatio?: number;
  closeUpPercent?: number;
  first30sShotCount?: number;
  first30sHook?: string;
};

/** 脚本工作台中的单条镜头/节拍（持久化进画布 JSON） */
export type ScriptBeat = {
  id: string;
  /** 与 `id` 对齐的镜头稳定 ID（下游 `scriptBeatId` 绑定；执行器回填时与 id 相同） */
  shotId?: string;
  /** 全局时间轴入点（秒） */
  timeIn?: number;
  /** 全局时间轴出点（秒） */
  timeOut?: number;
  /** 镜号 */
  shotNumber: string;
  /** 时长 */
  durationHint: string;
  /** 画面描述 */
  description: string;
  /** 新版角色模型（主模型）：支持 1-n 角色 */
  characters?: ScriptRole[];
  /** 情绪 */
  emotion: string;
  /** 镜头标签/叙事目的 */
  sceneTags: string;
  /** 对白 */
  dialogue: string;
  /** 场号标题（如 1-1 日 外 悬崖） */
  sceneHeading?: string;
  /** 集-场-镜号（如 1-1-03） */
  episodeSceneShot?: string;
  /** 景别（规则引擎 / 枚举） */
  shotSize?: string;
  /** 运镜（枚举：固定/推/拉/摇/移/跟/环绕） */
  cameraMove?: string;
  /** 机位角度（平视/仰拍等） */
  cameraAngle?: string;
  /** 声音提示 */
  soundHint?: string;
  /** 剪辑重点 / 转场 */
  editFocus?: string;
  /** 节奏功能（建立空间/推进/转折/反应镜等） */
  rhythmTag?: string;
  /** 完整分镜块（导出/预览用，画面描述见 description） */
  storyboardBlock?: string;
  /** 是否为反应镜头 */
  isReactionShot?: boolean;
  /** 对白类型：对白 / OS / VO / 旁白 / 字幕 */
  dialogueType?: string;
  /** 表演备注（兴奋、皱眉等） */
  performanceNote?: string;
  /** BGM 氛围提示 */
  bgmHint?: string;
  /** Seedance 2.0 正向提示词 */
  storyboardPrompt: string;
  /** Seedance 2.0 负向提示词 */
  videoMotionPrompt: string;
  /** Seedance 2.0 正向提示词（新管线生成） */
  seedancePositive?: string;
  /** Seedance 2.0 负面提示词（新管线生成） */
  seedanceNegative?: string;
  // ── 以下字段已废弃，保留仅用于旧工程兼容 ──
  /** @deprecated 已弃用 */
  scene: string;
  /** @deprecated 已弃用，使用 characters[] */
  character1: string;
  /** @deprecated 已弃用 */
  character1Desc: string;
  /** @deprecated 已弃用 */
  character1Image: string;
  /** @deprecated 已弃用 */
  character1ImageAssetId?: string;
  /** @deprecated 已弃用，使用 characters[] */
  character2: string;
  /** @deprecated 已弃用 */
  character2Desc: string;
  /** @deprecated 已弃用 */
  character2Image: string;
  /** @deprecated 已弃用 */
  character2ImageAssetId?: string;
  /** @deprecated 已弃用 */
  reference: string;
  /** @deprecated 旧工程兼容；新管线使用可选 shotSize */
  shotSizeLegacy?: string;
  /** @deprecated 已弃用，使用 characters[].action */
  characterAction: string;
  /** @deprecated 已弃用 */
  lightingMood: string;
  /** @deprecated 已弃用，音效不再由 LLM 生成 */
  soundEffect: string;
};

/** 由脚本条目生成的分镜文案（R4：文生图/视频前的画面描述，持久化进脚本节点） */
export type StoryboardShotStatus = "idle" | "generating" | "generated" | "failed";

/** 视频生成状态（R4 联动：跟踪 videoNode 生成状态） */
export type VideoShotStatus = "idle" | "generating" | "generated" | "failed";

/** 由脚本条目生成的分镜文案（R4：文生图/视频前的画面描述，持久化进脚本节点） */
export type StoryboardShot = {
  /** 对应 `ScriptBeat.id` */
  scriptBeatId: string;
  /** 画面/镜头描述，供后续图生或人工拍摄参考 */
  visualPrompt: string;
  /** 可选：构图、光线、镜头语言补充 */
  compositionNote?: string;
  /** 可选：负面提示 */
  negativePrompt?: string;
  /** 可选：已关联的分镜图（工程相对路径，如 assets/xxx.png，由本机选择导入） */
  imagePath?: string;
  /** 可选：分镜图对应素材 ID（与 imagePath 同步，供按 id 解析） */
  imageAssetId?: string;
  /** 生成状态：idle | generating | generated | failed */
  status?: StoryboardShotStatus;
  /** 失败原因（供 UI 显示） */
  error?: string;
  /** 重试次数 */
  retryCount?: number;
  /** 视频生成状态（R4 联动：videoNode 生成状态） */
  videoStatus?: VideoShotStatus;
  /** 关联的 videoNodeId（Hermes 创建时写入） */
  videoNodeId?: string;
  /** 视频生成失败原因 */
  videoError?: string;
};

/** 文本节点「尝试」入口进入的工作流（存于 params.textWorkflow） */
export type TextWorkflowKind =
  | "writeSelf"
  | "textToVideo"
  | "textToScript"
  | "textToImage"
  | "imageToPrompt"
  | "videoToPrompt"
  | "textToMusic"
  | "scriptToText";

/** 节点运行状态（C.1：节点状态机） */
export type NodeExecutionStatus = "idle" | "pending" | "running" | "succeeded" | "failed" | "skipped";

/** 节点状态记录 */
export type NodeStatus = {
  /** 当前状态 */
  status: NodeExecutionStatus;
  /** 最后更新时间 */
  updatedAt: number;
  /** 当前运行的 Agent 名称 */
  agentName?: string;
  /** 当前运行阶段 */
  phase?: string;
  /** 错误信息 */
  error?: string;
  /** 进度 0-100 */
  progress?: number;
};

/** 画布 group 节点语义（默认 workflow） */
export type GroupNodeKind = "workflow" | "storyboard";

export type FlowNodeData = {
  label?: string;
  /** 仅 type=group：分组种类 */
  groupKind?: GroupNodeKind;
  /** 分镜组绑定的脚本节点 id */
  groupScriptNodeId?: string;
  /** 分镜组镜头范围（空则按组内节点 params.scriptBeatId 推导） */
  groupScriptBeatIds?: string[];
  /** 组框色标（见 canvasGroupColors） */
  groupColorToken?: string;
  /** 文本/脚本梗概；`audioNode` 为待 TTS 文案；`imageNode`/`imageAsset` 为生成提示词（与展开面板、属性侧栏同步） */
  prompt?: string;
  /** 各节点自定义参数；图片/音频/视频可与脚本镜头绑定 `scriptBeatId`、`shotNumber` */
  params?: Record<string, unknown>;
  path?: string;
  /** 成片像素宽（上传/生成后写入，用于预览框比例） */
  imageWidth?: number;
  /** 成片像素高 */
  imageHeight?: number;
  /** 工程素材库中的稳定 ID（与 path 双写，见 M1） */
  assetId?: string;
  /** 仅 videoNode：上传/生成元数据与草稿（`video.draft.prompt` 与展开面板、属性侧栏同步） */
  video?: VideoNodePersisted;
  inputs?: string[];
  /** 剪辑节点：时间线片段（含入出点）；优先于 legacy `inputs` */
  timelineClips?: ComposeTimelineClip[];
  output?: string;
  /** ffmpegConcat：导出容器/编码（与 output 扩展名同步；iter-60 ProRes/GIF） */
  exportFormat?: import("@/lib/compose/timelineExportFormat").TimelineExportFormat;
  /** ffmpegConcat：导出分辨率与码率（见 timelineExportEncode） */
  exportEncode?: import("@/lib/compose/timelineExportEncode").TimelineExportEncodeSettings;
  /** 脚本节点：结构化条目，供工作台表格/卡片与恢复 */
  scriptBeats?: ScriptBeat[];
  /** 脚本工作台：已勾选镜头 id（与 canvasflow.json 一并保存） */
  scriptBeatSelection?: string[];
  /** 分镜结果：与 scriptBeats 按 scriptBeatId 关联 */
  storyboardShots?: StoryboardShot[];
  /** 脚本节点：全部镜头的总时长（秒），由执行器解析回填 */
  scriptTotalDurationSec?: number;
  /** 脚本节点：镜头条数，由执行器解析回填 */
  scriptShotCount?: number;
  /** 集级节奏报告（前 30 秒钩子、特写占比等） */
  scriptRhythmReport?: ScriptRhythmReport;
  /** 节点预览主交付：整份可编辑分镜稿 */
  storyboardDraft?: string;
  /** 分镜稿版本：每次解析 +1 */
  storyboardDraftRevision?: number;
  /** 最近一次解析是否走了自动规划（不对画布展示） */
  scriptParseAutoPlanned?: boolean;
  /** 人物弧分析摘要（编剧 pass，静默写入） */
  characterArcNotes?: {
    applied?: boolean;
    episodeHookNote?: string;
    turningPointCount?: number;
    characters?: Array<{
      name: string;
      arcSummary?: string;
      startState?: string;
      endState?: string;
      relationshipNotes?: string;
    }>;
  };
  /** 对白改写摘要（编剧 pass，静默写入） */
  dialogueRewriteNotes?: {
    applied?: boolean;
    mode?: "preserve" | "light" | "short_drama";
    rewriteCount?: number;
    skippedCount?: number;
  };
  /** 节点运行状态（C.1：节点状态机） */
  status?: NodeStatus;
};

export type CanvasFileV1 = {
  version: 1;
  viewport: Viewport;
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
};

/** v2 统一图片节点格式 */
export type CanvasFileV2 = {
  version: 2;
  viewport: Viewport;
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
};
