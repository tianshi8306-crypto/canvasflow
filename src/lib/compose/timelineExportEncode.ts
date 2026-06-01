import type { FlowNodeData } from "@/lib/types";

export type TimelineExportResolution = "source" | "1080p" | "720p" | "480p";

export type TimelineExportEncodeSettings = {
  resolution?: TimelineExportResolution;
  /** 0 或未设 = 自动（CRF）；>0 = 目标视频码率 kbps */
  videoBitrateKbps?: number;
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

export const DEFAULT_EXPORT_ENCODE: TimelineExportEncodeSettings = {
  resolution: "source",
  videoBitrateKbps: 0,
};

export function isTimelineExportResolution(value: string): value is TimelineExportResolution {
  return TIMELINE_EXPORT_RESOLUTIONS.some((r) => r.id === value);
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
  return { resolution, videoBitrateKbps: kbps };
}

export function exportEncodeNeedsReencode(settings: TimelineExportEncodeSettings): boolean {
  const res = settings.resolution ?? "source";
  const kbps = settings.videoBitrateKbps ?? 0;
  return res !== "source" || kbps > 0;
}

export function bitratePresetIdFromKbps(kbps: number): string {
  const hit = TIMELINE_EXPORT_BITRATE_PRESETS.find((p) => p.kbps === kbps);
  return hit?.id ?? (kbps > 0 ? "custom" : "auto");
}

/** 传给 Tauri `render_timeline` 的 encodeOptions */
export function exportEncodeToInvokePayload(
  settings: TimelineExportEncodeSettings,
): { resolution: string; videoBitrateKbps: number } | undefined {
  const normalized = {
    resolution: settings.resolution ?? "source",
    videoBitrateKbps: settings.videoBitrateKbps ?? 0,
  };
  if (!exportEncodeNeedsReencode(normalized)) return undefined;
  return {
    resolution: normalized.resolution,
    videoBitrateKbps: normalized.videoBitrateKbps,
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
  return `${res} · ${br}`;
}
