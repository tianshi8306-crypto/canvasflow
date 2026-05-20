/**
 * Seedance 视频生成 API 类型定义
 * 火山方舟: https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks
 */

/** 支持的 Seedance 模型 */
export type SeedanceModelId =
  | "seedance-2.0"
  | "seedance-2.0-fast"
  | "seedance-1.5-pro"
  | "seedance-1.0-pro"
  | "seedance-1.0-pro-fast"
  | "seedance-1.0-lite";

/** 内容类型 */
export type SeedanceContentType =
  | "text"
  | "image_url"
  | "video_url"
  | "audio_url"
  | "draft_task";

/** 图片角色 */
export type ImageRole = "first_frame" | "last_frame" | "reference_image";

/** 视频角色 */
export type VideoRole = "reference_video" | "first_frame" | "last_frame";

/** 分辨率 */
export type SeedanceResolution = "480p" | "720p" | "1080p";

/** 比例 */
export type SeedanceRatio =
  | "16:9"
  | "4:3"
  | "1:1"
  | "3:4"
  | "9:16"
  | "21:9"
  | "adaptive";

/** 内容项 */
export interface SeedanceContentItem {
  type: SeedanceContentType;
  text?: string;
  data?: string; // base64 编码的文件内容
  role?: ImageRole | VideoRole | string;
}

/** 任务参数 */
export interface SeedanceParameters {
  duration?: number; // 2.0: [4,15] 或 -1(智能); 1.5: [4,12] 或 -1
  resolution?: SeedanceResolution;
  ratio?: SeedanceRatio;
  generate_audio?: boolean;
  seed?: number; // [-1, 2^32-1]
  return_last_frame?: boolean;
  tools?: ("web_search")[];
  service_tier?: "default" | "flex";
}

/** 创建任务请求 */
export interface SeedanceCreateTaskRequest {
  model: SeedanceModelId;
  content: SeedanceContentItem[];
  parameters?: SeedanceParameters;
  callback_url?: string;
}

/** 创建任务响应 */
export interface SeedanceCreateTaskResponse {
  id: string; // 任务 ID，仅保存 7 天
}

/** 任务状态 */
export type SeedanceTaskStatus =
  | "pending"    // 等待中
  | "processing" // 处理中
  | "succeeded"  // 成功
  | "failed";    // 失败

/** 任务结果 */
export interface SeedanceTaskResult {
  video_url?: string;
  first_frame_url?: string;
  last_frame_url?: string;
  duration?: number;
}

/** 查询任务响应 */
export interface SeedanceGetTaskResponse {
  id: string;
  status: SeedanceTaskStatus;
  progress?: number; // 0-1
  error?: {
    code?: string;
    message?: string;
  };
  result?: SeedanceTaskResult;
}

/** 视频生成配置（存储在节点 draft 中） */
export interface SeedanceGenerationConfig {
  model: SeedanceModelId;
  prompt: string;
  referenceImagePaths?: string[]; // ≤9张
  referenceVideoPaths?: string[]; // ≤3个
  referenceAudioPaths?: string[]; // ≤3个
  output: {
    duration?: number;
    resolution?: SeedanceResolution;
    ratio?: SeedanceRatio;
    generateAudio?: boolean;
  };
  cameraMovement?: string; // 运镜提示词
}
