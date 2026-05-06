/**
 * 视频节点多模态输入约束（产品/后端约定，用于 UI 提示与后续校验）
 */

export const VIDEO_REFERENCE_IMAGE = {
  formats: ["jpeg", "jpg", "png", "webp", "bmp", "tiff", "tif", "gif"] as const,
  maxCount: 9,
  maxBytesPerFile: 30 * 1024 * 1024,
} as const;

export const VIDEO_REFERENCE_VIDEO = {
  formats: ["mp4", "mov"] as const,
  maxCount: 3,
  maxTotalBytes: 50 * 1024 * 1024,
  durationSecRange: [2, 15] as const,
  /** 总像素数范围（示例：640×480、834×1112） */
  totalPixelsRange: [409600, 927408] as const,
} as const;

export const VIDEO_REFERENCE_AUDIO = {
  formats: ["mp3", "wav"] as const,
  maxCount: 3,
  maxTotalDurationSec: 15,
  maxBytesPerFile: 15 * 1024 * 1024,
} as const;

/** 混合参考文件总上限（图片+视频+音频等） */
export const VIDEO_MIXED_REFERENCE_MAX_FILES = 12;

export const VIDEO_GENERATION_DURATION_SEC = {
  min: 4,
  max: 15,
} as const;

/** 首帧工作流默认提示（全能参考 / 首帧图） */
export const FIRST_FRAME_DEFAULT_PROMPT = "以当前图为首帧生成视频。";

export function videoInputConstraintsSummary(): string {
  return [
    `图片：${VIDEO_REFERENCE_IMAGE.formats.join("、")}，≤${VIDEO_REFERENCE_IMAGE.maxCount} 张，单张 <30MB`,
    `视频：${VIDEO_REFERENCE_VIDEO.formats.join("、")}，≤${VIDEO_REFERENCE_VIDEO.maxCount} 个，总时长 ${VIDEO_REFERENCE_VIDEO.durationSecRange[0]}–${VIDEO_REFERENCE_VIDEO.durationSecRange[1]}s，总大小 <50MB`,
    `音频：${VIDEO_REFERENCE_AUDIO.formats.join("、")}，≤${VIDEO_REFERENCE_AUDIO.maxCount} 个，总时长 ≤${VIDEO_REFERENCE_AUDIO.maxTotalDurationSec}s，单文件 <15MB`,
    `文本：自然语言；成片时长 ${VIDEO_GENERATION_DURATION_SEC.min}–${VIDEO_GENERATION_DURATION_SEC.max}s`,
    `参考文件总数 ≤${VIDEO_MIXED_REFERENCE_MAX_FILES} 个`,
  ].join("；");
}
