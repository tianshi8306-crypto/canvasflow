/**
 * 视频节点领域模型：单一画布节点承载一条成片（上传或生成），持久化在 FlowNodeData.video + path。
 */

/** 成片来源 */
export type VideoSourceKind = "upload" | "generation";

/**
 * 生成工作流（与面板 Tab / 后端能力对齐；未接入前部分仅为占位）
 */
export type VideoGenerationWorkflow =
  | "text_to_video"
  | "multimodal_reference"
  | "image_to_video"
  | "first_last_frame"
  | "image_reference"
  | "video_reference"
  | "video_edit"
  | "video_extend";

/** 视频模型标识，取 Settings.videoModels[].model 的值（API 真实标识） */
export type VideoModelId = string;

export const TEXT_TO_VIDEO_ASPECT_IDS = [
  "auto",
  "16:9",
  "4:3",
  "1:1",
  "3:4",
  "9:16",
  "21:9",
] as const;

export type TextToVideoAspectId = (typeof TEXT_TO_VIDEO_ASPECT_IDS)[number];

export const TEXT_TO_VIDEO_ASPECT_LABEL: Record<TextToVideoAspectId, string> = {
  auto: "自动",
  "16:9": "16:9",
  "4:3": "4:3",
  "1:1": "1:1",
  "3:4": "3:4",
  "9:16": "9:16",
  "21:9": "21:9",
};

/** 运镜预设（与产品图一网格一致） */
export type CameraPresetId =
  | "fixed"
  | "follow"
  | "spiral_up"
  | "spiral_down"
  | "tilt_up"
  | "tilt_down"
  | "pan_left"
  | "pan_right"
  | "pedestal_up"
  | "pedestal_down"
  | "truck_left"
  | "truck_right";

/** 用户自定义运镜：与「预设」图一同款语义，通过自然语言提示词建立，提交生成时带给后端 */
export type CameraCustomMove = {
  id: string;
  /** 列表/卡片展示名，可空则取提示词摘要 */
  name: string;
  /** 运镜提示词（主字段，描述镜头运动、节奏、景别等） */
  prompt: string;
};

export type CameraMovementDraft = {
  /** 当前选中的预设（与自定义二选一，生成时带给后端） */
  presetId?: CameraPresetId;
  /** 自定义列表中当前选中的条目 */
  selectedCustomMoveId?: string;
  favoritePresetIds?: CameraPresetId[];
  customMoves?: CameraCustomMove[];
  /**
   * 运镜块插入到 `prompt` 中的字符下标（0..length），拖动标签即改变该位置。
   * 融合时：`prompt.slice(0,i) + 运镜文本 + prompt.slice(i)`，用户无需单独写运镜句。
   */
  insertIndex?: number;
  /** @deprecated 旧版：由 insertIndex 替代，读档时迁移 */
  tagPlacement?: "before_prompt" | "after_prompt";
};

export type VideoGenOutputSpec = {
  /** 与 UI 比例选择一致，如 auto / 16:9 */
  aspectRatio: TextToVideoAspectId;
  resolution: "480P" | "720P" | "1080P";
  durationSec: number;
  generateAudio: boolean;
  /** 水印开关，默认 false（无水印） */
  watermark?: boolean;
  /** 生成时提示去字幕（部分模型/工作流） */
  noSubtitles?: boolean;
};

/** 单段裁剪入出点（秒）；导出后仍保留便于再调 */
export type VideoSourceTrim = {
  inSec: number;
  outSec: number;
};

/** 框选去字幕：相对编码帧的归一化矩形（原点左上，0..1） */
export type VideoSubtitleRegion = {
  x: number;
  y: number;
  w: number;
  h: number;
};

/** 与面板同步的生成草稿（持久化） */
export type VideoGenerationDraft = {
  workflow: VideoGenerationWorkflow;
  /** 用户手动点 Tab 锁定后，连线变化不再自动覆盖 workflow */
  workflowLocked?: boolean;
  modelId: VideoModelId;
  /** 主提示词；图生/编辑等可复用 */
  prompt: string;
  /** 工程内相对路径 */
  referenceImagePaths?: string[];
  referenceVideoPaths?: string[];
  /** 参考音频（mp3/wav 等），与画布左侧音频节点连线同步 */
  referenceAudioPaths?: string[];
  /** 参考条缩略图顺序（edgeId 列表）；未设置时按源节点 Y 坐标排序 */
  referenceEdgeOrder?: string[];
  output: VideoGenOutputSpec;
  /** 运镜：预设 / 自定义列表 / 收藏 */
  cameraMovement?: CameraMovementDraft;
  /** Seedance 2.0 人脸审核通关开关（默认开启，仅火山方舟模式生效） */
  faceBypassEnabled?: boolean;
};

/** 面板增量更新（允许只改 output 子字段） */
export type VideoGenerationDraftPatch = Omit<Partial<VideoGenerationDraft>, "output" | "cameraMovement"> & {
  output?: Partial<VideoGenOutputSpec>;
  cameraMovement?: Partial<CameraMovementDraft>;
};

export type VideoJobStatus = "idle" | "queued" | "running" | "succeeded" | "failed" | "cancelled";

/** 仅 videoNode 使用：存在 FlowNodeData.video */
export type VideoNodePersisted = {
  /** 最近一次写入成片的来源 */
  source?: VideoSourceKind;
  /** 预览元数据：用于裁剪 / 框选 UI */
  sourceDurationSec?: number;
  sourceWidth?: number;
  sourceHeight?: number;
  /** 单段裁剪范围 */
  sourceTrim?: VideoSourceTrim;
  /** 框选去字幕区域（持久化） */
  subtitleRegion?: VideoSubtitleRegion;
  draft: VideoGenerationDraft;
  /** 进行中的远端任务（由 API 返回 jobId） */
  activeJob?: {
    id: string;
    status: VideoJobStatus;
    progress?: number;
    error?: string | null;
    modelId: VideoModelId;
    startedAt?: string;
  };
};

export function defaultVideoGenerationDraft(): VideoGenerationDraft {
  return {
    workflow: "text_to_video",
    modelId: "doubao_seedance_2_0",
    prompt: "",
    output: {
      aspectRatio: "16:9",
      resolution: "720P",
      durationSec: 5,
      generateAudio: true,
      watermark: false,
    },
  };
}

export function defaultVideoNodePersisted(): VideoNodePersisted {
  return {
    source: undefined,
    draft: defaultVideoGenerationDraft(),
  };
}
