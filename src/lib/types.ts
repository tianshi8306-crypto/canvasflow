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
  /** 场次简写（旧版工程可能含此字段；界面已不展示，读入时仍保留） */
  scene: string;
  /** 时长 */
  durationHint: string;
  /** 画面描述 */
  description: string;
  /** 角色 1 */
  character1: string;
  character1Desc: string;
  /** 角色图 1（工程相对路径） */
  character1Image: string;
  /** 角色图 1 素材 ID（与 character1Image 双写，M3） */
  character1ImageAssetId?: string;
  character2: string;
  character2Desc: string;
  character2Image: string;
  /** 角色图 2 素材 ID（与 character2Image 双写，M3） */
  character2ImageAssetId?: string;
  /** 新版角色模型（主模型）：支持 1-n 角色。旧字段继续保留用于兼容历史工程与旧 UI。 */
  characters?: ScriptRole[];
  /** 参考 */
  reference: string;
  /** 景别（旧版 `shot` 会在加载时并入此项） */
  shotSize: string;
  characterAction: string;
  emotion: string;
  sceneTags: string;
  lightingMood: string;
  soundEffect: string;
  dialogue: string;
  storyboardPrompt: string;
  videoMotionPrompt: string;
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
  retryCount?: string;
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
