import type { ScriptBeat } from "@/lib/types";

/** 从旧 sceneTags（运镜: xxx）解析运镜，兼容历史数据 */
export function extractCameraMove(sceneTags: string): string {
  const raw = (sceneTags ?? "").trim();
  if (!raw) return "";
  const m = raw.match(/^运镜[:：]\s*(.+)$/);
  return m ? m[1].trim() : raw;
}

export function toSceneTags(cameraMove: string): string {
  const m = cameraMove.trim();
  if (!m) return "";
  return `运镜: ${m}`;
}

/** 优先读结构化 cameraMove 字段 */
export function readCameraMove(beat: Pick<ScriptBeat, "cameraMove" | "sceneTags">): string {
  const direct = (beat.cameraMove ?? "").trim();
  if (direct) return direct;
  return extractCameraMove(beat.sceneTags ?? "");
}

export function parseShotNumberRank(shotNumber: string): number {
  const raw = (shotNumber ?? "").trim();
  if (!raw) return Number.POSITIVE_INFINITY;
  const m = raw.match(/^\d+(?:\.\d+)?/);
  if (!m) return Number.POSITIVE_INFINITY;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

export function parseLeadingNumber(rawShotNumber: string): number | null {
  const raw = (rawShotNumber ?? "").trim();
  if (!raw) return null;
  const m = raw.match(/^\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}
