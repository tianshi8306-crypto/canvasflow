import type { FlowNodeData } from "@/lib/types";
import type { TimelineExportFormat } from "./timelineExportFormat";

export type TimelineExportResolution = "source" | "1080p" | "720p" | "480p";

export type TimelineExportFps = "source" | "24" | "25" | "30" | "60";

export type TimelineExportEncodeSettings = {
  resolution?: TimelineExportResolution;
  /** 0 或未设 = 自动（CRF）；>0 = 目标视频码率 kbps */
  videoBitrateKbps?: number;
  /** 帧率："source" 使用素材帧率；数字值强制指定 */
  fps?: TimelineExportFps;
};

export const TIMELINE_EXPORT_RESOLUTIONS: {
  id: TimelineExportResolution;
  label: string;
}[] = [
  { id: "source", label: "源尺寸" },
  { id: "1080p", label: "1080p (1920×1080)" },
  { id: "720p", label: "720p (1280×720)" },
  { id: "480p", label: "480p (854×480)" },
];

export const TIMELINE_EXPORT_FPS_OPTIONS: {
  id: TimelineExportFps;
  label: string;
}[] = [
  { id: "source", label: "源帧率" },
  { id: "24", label: "24 fps" },
  { id: "25", label: "25 fps" },
  { id: "30", label: "30 fps" },
  { id: "60", label: "60 fps" },
];

export const TIMELINE_EXPORT_BITRATE_PRESETS: {
  id: string;
  label: string;
  kbps: number;
}[] = [
  { id: "auto", label: "自动 (CRF)", kbps: 0 },
  { id: "2m", label: "2 Mbps", kbps: 2000 },
  { id: "4m", label: "4 Mbps", kbps: 4000 },
  { id: "8m", label: "8 Mbps", kbps: 8000 },
  { id: "12m", label: "12 Mbps", kbps: 12000 },
];

/** 平台导出预设 */
export type PlatformExportPreset = {
  id: string;
  label: string;
  /** 中文别名 */
  alias: string;
  resolution: TimelineExportResolution;
  fps: TimelineExportFps;
  format: TimelineExportFormat;
  bitrateKbps: number;
  /** 提示文案 */
  hint: string;
};

export const PLATFORM_EXPORT_PRESETS: PlatformExportPreset[] = [
  {
    id: "douyin",
    label: "抖音",
    alias: "抖音 / TikTok 竖屏",
    resolution: "1080p",
    fps: "30",
    format: "mp4",
    bitrateKbps: 8000,
    hint: "1080×1920 竖屏 · 30fps · 8Mbps",
  },
  {
    id: "bilibili",
    label: "哔哩哔哩",
    alias: "B站",
    resolution: "1080p",
    fps: "30",
    format: "mp4",
    bitrateKbps: 6000,
    hint: "1920×1080 横屏 · 30fps · 6Mbps",
  },
  {
    id: "xiaohongshu",
    label: "小红书",
    alias: "小红书",
    resolution: "1080p",
    fps: "30",
    format: "mp4",
    bitrateKbps: 4000,
    hint: "1080×1440 (3:4) · 30fps · 4Mbps",
  },
  {
    id: "youtube",
    label: "YouTube",
    alias: "YouTube",
    resolution: "1080p",
    fps: "30",
    format: "mp4",
    bitrateKbps: 12000,
    hint: "1920×1080 · 30fps · 12Mbps",
  },
  {
    id: "wechat",
    label: "微信",
    alias: "微信视频号",
    resolution: "720p",
    fps: "30",
    format: "mp4",
    bitrateKbps: 3000,
    hint: "720p · 30fps · 3Mbps（微信压缩友好）",
  },
];

export const DEFAULT_EXPORT_ENCODE: TimelineExportEncodeSettings = {
  resolution: "source",
  videoBitrateKbps: 0,
  fps: "source",
};

export function isTimelineExportResolution(value: string): value is TimelineExportResolution {
  return TIMELINE_EXPORT_RESOLUTIONS.some((r) => r.id === value);
}

export function isTimelineExportFps(value: string): value is TimelineExportFps {
  return TIMELINE_EXPORT_FPS_OPTIONS.some((f) => f.id === value);
}

export function normalizeExportEncode(data: FlowNodeData): TimelineExportEncodeSettings {
  const raw = data.exportEncode;
  const resolution =
    raw?.resolution && isTimelineExportResolution(raw.resolution)
      ? raw.resolution
      : DEFAULT_EXPORT_ENCODE.resolution;
  const kbps =
    typeof raw?.videoBitrateKbps === "number" && Number.isFinite(raw.videoBitrateKbps)
      ? Math.max(0, Math.round(raw.videoBitrateKbps))
      : 0;
  const fps =
    raw?.fps && isTimelineExportFps(raw.fps) ? raw.fps : DEFAULT_EXPORT_ENCODE.fps;
  return { resolution, videoBitrateKbps: kbps, fps };
}

export function exportEncodeNeedsReencode(settings: TimelineExportEncodeSettings): boolean {
  const res = settings.resolution ?? "source";
  const kbps = settings.videoBitrateKbps ?? 0;
  const fps = settings.fps ?? "source";
  return res !== "source" || kbps > 0 || fps !== "source";
}

export function bitratePresetIdFromKbps(kbps: number): string {
  const hit = TIMELINE_EXPORT_BITRATE_PRESETS.find((p) => p.kbps === kbps);
  return hit?.id ?? (kbps > 0 ? "custom" : "auto");
}

/** 传给 Tauri `render_timeline` 的 encodeOptions */
export function exportEncodeToInvokePayload(
  settings: TimelineExportEncodeSettings,
): { resolution: string; videoBitrateKbps: number; fps?: string } | undefined {
  const normalized = {
    resolution: settings.resolution ?? "source",
    videoBitrateKbps: settings.videoBitrateKbps ?? 0,
    fps: settings.fps ?? "source",
  };
  if (!exportEncodeNeedsReencode(normalized)) return undefined;
  return {
    resolution: normalized.resolution,
    videoBitrateKbps: normalized.videoBitrateKbps,
    fps: normalized.fps !== "source" ? normalized.fps : undefined,
  };
}

export function exportEncodeSummary(settings: TimelineExportEncodeSettings): string {
  const res =
    TIMELINE_EXPORT_RESOLUTIONS.find((r) => r.id === (settings.resolution ?? "source"))?.label ??
    "源尺寸";
  const kbps = settings.videoBitrateKbps ?? 0;
  const br =
    kbps > 0
      ? TIMELINE_EXPORT_BITRATE_PRESETS.find((p) => p.kbps === kbps)?.label ?? `${kbps} kbps`
      : "自动码率";
  const fpsLabel =
    settings.fps && settings.fps !== "source"
      ? ` · ${settings.fps}fps`
      : "";
  return `${res} · ${br}${fpsLabel}`;
}
