/**
 * Seedance 多模态输入验证层
 *
 * 规格：
 * - 图片：jpeg, png，≤9张，每张 < 30MB
 * - 视频：mp4, mov，≤3个，总时长 2-15s，总像素 409600-927408，每部 < 50MB
 * - 音频：mp3, wav，≤3个，总时长 ≤15s，每部 < 15MB
 * - 文本：自然语言
 * - 混合输入总上限：12 个文件
 */

export type AssetKind = "image" | "video" | "audio" | "text";

export interface MultimodalInputAsset {
  kind: AssetKind;
  path?: string;
  name?: string;
  size?: number; // bytes
  duration?: number; // seconds (for video/audio)
  width?: number;
  height?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  detail?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
}

// 文件数量限制
const MAX_IMAGES = 9;
const MAX_VIDEOS = 3;
const MAX_AUDIOS = 3;
const MAX_TOTAL_ASSETS = 12;

// 文件大小限制 (bytes)
const MAX_IMAGE_SIZE = 30 * 1024 * 1024; // 30MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_AUDIO_SIZE = 15 * 1024 * 1024; // 15MB

// 视频限制
const VIDEO_DURATION_MIN = 2;
const VIDEO_DURATION_MAX = 15;
const VIDEO_PIXELS_MIN = 409600;
const VIDEO_PIXELS_MAX = 927408;

// 音频限制
const AUDIO_DURATION_MAX = 15;

// 生成时长
const OUTPUT_DURATION_MIN = 4;
const OUTPUT_DURATION_MAX = 15;

/** 从文件扩展名推断资产类型 */
export function inferAssetKind(fileName: string): AssetKind | null {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg" || ext === "png") return "image";
  if (ext === "mp4" || ext === "mov") return "video";
  if (ext === "mp3" || ext === "wav") return "audio";
  return null;
}

/** 验证单张图片 */
function validateImage(asset: MultimodalInputAsset): ValidationError[] {
  const errors: ValidationError[] = [];
  if (asset.size && asset.size > MAX_IMAGE_SIZE) {
    errors.push({
      code: "IMAGE_SIZE_EXCEEDED",
      message: `图片 ${asset.name || asset.path} 超过 30MB 限制`,
      detail: `实际大小: ${(asset.size / 1024 / 1024).toFixed(2)}MB`,
    });
  }
  return errors;
}

/** 验证单个视频 */
function validateVideo(asset: MultimodalInputAsset): ValidationError[] {
  const errors: ValidationError[] = [];

  if (asset.size && asset.size > MAX_VIDEO_SIZE) {
    errors.push({
      code: "VIDEO_SIZE_EXCEEDED",
      message: `视频 ${asset.name || asset.path} 超过 50MB 限制`,
      detail: `实际大小: ${(asset.size / 1024 / 1024).toFixed(2)}MB`,
    });
  }

  if (asset.duration !== undefined) {
    if (asset.duration < VIDEO_DURATION_MIN || asset.duration > VIDEO_DURATION_MAX) {
      errors.push({
        code: "VIDEO_DURATION_INVALID",
        message: `视频 ${asset.name || asset.path} 时长不在 2-15s 范围内`,
        detail: `实际时长: ${asset.duration}s`,
      });
    }
  }

  if (asset.width && asset.height) {
    const pixels = asset.width * asset.height;
    if (pixels < VIDEO_PIXELS_MIN || pixels > VIDEO_PIXELS_MAX) {
      errors.push({
        code: "VIDEO_PIXELS_OUT_OF_RANGE",
        message: `视频 ${asset.name || asset.path} 像素不在有效范围内`,
        detail: `实际像素: ${pixels}，有效范围: ${VIDEO_PIXELS_MIN}-${VIDEO_PIXELS_MAX}`,
      });
    }
  }

  return errors;
}

/** 验证单个音频 */
function validateAudio(asset: MultimodalInputAsset): ValidationError[] {
  const errors: ValidationError[] = [];

  if (asset.size && asset.size > MAX_AUDIO_SIZE) {
    errors.push({
      code: "AUDIO_SIZE_EXCEEDED",
      message: `音频 ${asset.name || asset.path} 超过 15MB 限制`,
      detail: `实际大小: ${(asset.size / 1024 / 1024).toFixed(2)}MB`,
    });
  }

  if (asset.duration && asset.duration > AUDIO_DURATION_MAX) {
    errors.push({
      code: "AUDIO_DURATION_EXCEEDED",
      message: `音频 ${asset.name || asset.path} 时长超过 15s 限制`,
      detail: `实际时长: ${asset.duration}s`,
    });
  }

  return errors;
}

/**
 * 验证多模态输入资产列表
 */
export function validateMultimodalInput(assets: MultimodalInputAsset[]): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // 分类统计
  const images = assets.filter((a) => a.kind === "image");
  const videos = assets.filter((a) => a.kind === "video");
  const audios = assets.filter((a) => a.kind === "audio");

  // 检查总数量
  if (assets.length > MAX_TOTAL_ASSETS) {
    errors.push({
      code: "TOTAL_ASSETS_EXCEEDED",
      message: `混合输入超过 12 个文件上限`,
      detail: `实际文件数: ${assets.length}`,
    });
  }

  // 检查图片数量
  if (images.length > MAX_IMAGES) {
    errors.push({
      code: "IMAGE_COUNT_EXCEEDED",
      message: `图片数量超过 ${MAX_IMAGES} 张限制`,
      detail: `实际数量: ${images.length}`,
    });
  }

  // 检查视频数量
  if (videos.length > MAX_VIDEOS) {
    errors.push({
      code: "VIDEO_COUNT_EXCEEDED",
      message: `视频数量超过 ${MAX_VIDEOS} 个限制`,
      detail: `实际数量: ${videos.length}`,
    });
  }

  // 检查音频数量
  if (audios.length > MAX_AUDIOS) {
    errors.push({
      code: "AUDIO_COUNT_EXCEEDED",
      message: `音频数量超过 ${MAX_AUDIOS} 个限制`,
      detail: `实际数量: ${audios.length}`,
    });
  }

  // 逐个验证
  for (const asset of images) {
    errors.push(...validateImage(asset));
  }
  for (const asset of videos) {
    errors.push(...validateVideo(asset));
  }
  for (const asset of audios) {
    errors.push(...validateAudio(asset));
  }

  // 检查总视频时长
  const totalVideoDuration = videos.reduce((sum, v) => sum + (v.duration || 0), 0);
  if (totalVideoDuration > 0 && (totalVideoDuration < VIDEO_DURATION_MIN || totalVideoDuration > VIDEO_DURATION_MAX)) {
    errors.push({
      code: "VIDEO_TOTAL_DURATION_INVALID",
      message: `视频总时长不在 2-15s 范围内`,
      detail: `实际总时长: ${totalVideoDuration}s`,
    });
  }

  // 检查总音频时长
  const totalAudioDuration = audios.reduce((sum, a) => sum + (a.duration || 0), 0);
  if (totalAudioDuration > AUDIO_DURATION_MAX) {
    errors.push({
      code: "AUDIO_TOTAL_DURATION_EXCEEDED",
      message: `音频总时长超过 ${AUDIO_DURATION_MAX}s 限制`,
      detail: `实际总时长: ${totalAudioDuration}s`,
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * 验证生成输出参数
 */
export function validateOutputDuration(duration: number): ValidationResult {
  const errors: ValidationError[] = [];

  if (duration < OUTPUT_DURATION_MIN || duration > OUTPUT_DURATION_MAX) {
    errors.push({
      code: "OUTPUT_DURATION_INVALID",
      message: `生成时长必须在 ${OUTPUT_DURATION_MIN}-${OUTPUT_DURATION_MAX}s 范围内`,
      detail: `当前值: ${duration}s`,
    });
  }

  return { valid: errors.length === 0, errors, warnings: [] };
}

/** 导出限制常量供 UI 使用 */
export const MULTIMODAL_LIMITS = {
  MAX_IMAGES,
  MAX_VIDEOS,
  MAX_AUDIOS,
  MAX_TOTAL_ASSETS,
  MAX_IMAGE_SIZE,
  MAX_VIDEO_SIZE,
  MAX_AUDIO_SIZE,
  VIDEO_DURATION_MIN,
  VIDEO_DURATION_MAX,
  VIDEO_PIXELS_MIN,
  VIDEO_PIXELS_MAX,
  AUDIO_DURATION_MAX,
  OUTPUT_DURATION_MIN,
  OUTPUT_DURATION_MAX,
} as const;
