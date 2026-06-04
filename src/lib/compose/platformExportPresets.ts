/**
 * platformExportPresets.ts
 *
 * 平台导出预设：抖音/B站/小红书/YouTube Shorts 一键导出。
 * 自动计算 FFmpeg scale+pad 参数，确保画幅比例适配目标平台。
 */

/** 支持的平台 */
export const PLATFORM_EXPORT_PRESETS = [
  {
    id: "douyin",
    label: "抖音",
    description: "1080×1920 · 9:16 竖屏 · 4 Mbps",
    width: 1080,
    height: 1920,
    videoBitrateKbps: 4000,
    ext: "mp4",
  },
  {
    id: "bilibili",
    label: "B站",
    description: "1920×1080 · 16:9 横屏 · 自动码率",
    width: 1920,
    height: 1080,
    videoBitrateKbps: 0,
    ext: "mp4",
  },
  {
    id: "xiaohongshu",
    label: "小红书",
    description: "1080×1440 · 3:4 · 4 Mbps",
    width: 1080,
    height: 1440,
    videoBitrateKbps: 4000,
    ext: "mp4",
  },
  {
    id: "youtube_shorts",
    label: "YouTube Shorts",
    description: "1080×1920 · 9:16 竖屏 · 自动码率",
    width: 1080,
    height: 1920,
    videoBitrateKbps: 0,
    ext: "mp4",
  },
  {
    id: "youtube",
    label: "YouTube",
    description: "1920×1080 · 16:9 横屏 · 自动码率",
    width: 1920,
    height: 1080,
    videoBitrateKbps: 0,
    ext: "mp4",
  },
] as const;

export type PlatformExportPresetId = (typeof PLATFORM_EXPORT_PRESETS)[number]["id"];

export function getPlatformPreset(
  id: string,
): (typeof PLATFORM_EXPORT_PRESETS)[number] | undefined {
  return PLATFORM_EXPORT_PRESETS.find((p) => p.id === id);
}

export function isPlatformPresetId(value: string): value is PlatformExportPresetId {
  return PLATFORM_EXPORT_PRESETS.some((p) => p.id === value);
}
