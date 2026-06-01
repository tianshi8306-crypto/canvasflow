import type { FlowNodeData } from "@/lib/types";

/** 时间线 / 合成节点导出容器格式（G5） */
export const TIMELINE_EXPORT_FORMATS = [
  { id: "mp4", label: "MP4 (H.264)", ext: "mp4" },
  { id: "mov", label: "MOV (H.264)", ext: "mov" },
  { id: "webm", label: "WebM (VP9)", ext: "webm" },
  { id: "prores", label: "ProRes 422 (MOV)", ext: "mov" },
  { id: "gif", label: "GIF", ext: "gif" },
] as const;

export type TimelineExportFormat = (typeof TIMELINE_EXPORT_FORMATS)[number]["id"];

export const DEFAULT_EXPORT_REL_PATH = "assets/exports/final.mp4";

export function isTimelineExportFormat(value: string): value is TimelineExportFormat {
  return TIMELINE_EXPORT_FORMATS.some((f) => f.id === value);
}

export function exportFormatFileExt(format: TimelineExportFormat): string {
  return TIMELINE_EXPORT_FORMATS.find((f) => f.id === format)?.ext ?? "mp4";
}

/** 仅从路径推断（`.mov` 无法区分 ProRes / H.264） */
export function exportFormatFromOutputPath(path: string): TimelineExportFormat {
  const ext = path.trim().split(".").pop()?.toLowerCase();
  if (ext === "gif") return "gif";
  if (ext === "webm") return "webm";
  if (ext === "mov") return "mov";
  return "mp4";
}

/** 节点持久化的 `exportFormat` 优先，否则看路径 */
export function resolveExportFormat(data: FlowNodeData, outputPath: string): TimelineExportFormat {
  const stored = data.exportFormat;
  if (stored && isTimelineExportFormat(stored)) return stored;
  return exportFormatFromOutputPath(outputPath);
}

export function defaultExportRelPath(
  format: TimelineExportFormat = "mp4",
  baseName = "final",
): string {
  return `assets/exports/${baseName}.${exportFormatFileExt(format)}`;
}

/** 保留目录与文件名主干，仅替换扩展名。 */
export function applyExportFormatToPath(
  currentOutput: string,
  format: TimelineExportFormat,
): string {
  const trimmed = currentOutput.trim() || DEFAULT_EXPORT_REL_PATH;
  const slash = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  const dir = slash >= 0 ? trimmed.slice(0, slash + 1) : "assets/exports/";
  const file = slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
  const dot = file.lastIndexOf(".");
  const stem = dot > 0 ? file.slice(0, dot) : file || "final";
  return `${dir}${stem}.${exportFormatFileExt(format)}`;
}

export function parseExportFormatFromMessage(text: string): TimelineExportFormat | undefined {
  const t = text.trim();
  if (!t) return undefined;
  if (/\bgif\b|动图/i.test(t)) return "gif";
  if (/prores|pro\s*res|422/i.test(t)) return "prores";
  if (/webm|vp9/i.test(t)) return "webm";
  if (/\bmov\b|quicktime|苹果容器/i.test(t)) return "mov";
  if (/\bmp4\b|h\.?264\b/i.test(t)) return "mp4";
  return undefined;
}

export function parseExportFormatArg(
  value: unknown,
  fallbackMessage?: string,
): TimelineExportFormat | undefined {
  if (typeof value === "string" && isTimelineExportFormat(value)) return value;
  if (fallbackMessage) return parseExportFormatFromMessage(fallbackMessage);
  return undefined;
}

export function exportFormatLabel(format: TimelineExportFormat): string {
  return TIMELINE_EXPORT_FORMATS.find((f) => f.id === format)?.label ?? format.toUpperCase();
}

/** GIF 不使用视频码率预设 */
export function exportFormatSupportsBitrate(format: TimelineExportFormat): boolean {
  return format !== "gif";
}
