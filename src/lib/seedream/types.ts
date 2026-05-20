/**
 * Seedream 图生图 API 类型定义
 */

/** 支持的 Seedream 模型 */
export type SeedreamModelId =
  | "seedream-5.0"
  | "seedream-5.0-lite";

/** 图片风格 */
export type SeedreamStyle =
  | "realistic"      // 写实
  | "anime"          // 动漫
  | "oil_painting"   // 油画
  | "watercolor"      // 水彩
  | "cyberpunk"       // 赛博朋克
  | "fantasy"         // 奇幻
  | "illustration";   // 插画

/** 分辨率 */
export type SeedreamResolution =
  | "1024x1024"
  | "1536x1024"
  | "1024x1536"
  | "2048x2048";

/** 创建图片任务请求 */
export interface SeedreamCreateTaskRequest {
  model: SeedreamModelId;
  input: {
    prompt: string;
    negative_prompt?: string;
    images?: string[]; // 参考图 base64
  };
  parameters?: {
    resolution?: SeedreamResolution;
    style?: SeedreamStyle;
    seed?: number;
  };
}

/** 创建任务响应 */
export interface SeedreamCreateTaskResponse {
  id: string;
}

/** 任务状态 */
export type SeedreamTaskStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed";

/** 任务结果 */
export interface SeedreamTaskResult {
  image_url?: string;
  width?: number;
  height?: number;
}

/** 查询任务响应 */
export interface SeedreamGetTaskResponse {
  id: string;
  status: SeedreamTaskStatus;
  progress?: number;
  error?: {
    code?: string;
    message?: string;
  };
  result?: SeedreamTaskResult;
}
