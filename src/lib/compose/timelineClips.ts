import type { FlowNodeData } from "@/lib/types";
import type { ComposeClip } from "@/lib/compose/collectClips";
import { TIMELINE_FALLBACK_CLIP_SEC } from "@/lib/compose/timelineLayout";

/** 时间线上的可编辑片段（持久化在 ffmpegConcat 节点） */
export type ComposeTimelineClip = {
  id: string;
  relPath: string;
  inSec: number;
  /** null = 导出时使用素材全长（或已探测的 duration） */
  outSec: number | null;
  sourceNodeId?: string;
  label?: string;
  scriptBeatId?: string;
};

/** 导出给 Tauri `render_timeline` */
export type TimelineRenderClipPayload = {
  relPath: string;
  inSec: number;
  outSec: number | null;
};

export function newTimelineClipId(): string {
  return `tcl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** 从节点 data 读取时间线；兼容旧版 `inputs: string[]` */
export function normalizeTimelineClips(data: FlowNodeData): ComposeTimelineClip[] {
  const stored = data.timelineClips;
  if (Array.isArray(stored) && stored.length > 0) {
    return stored
      .filter((c) => c?.relPath?.trim())
      .map((c) => ({
        id: c.id?.trim() || newTimelineClipId(),
        relPath: c.relPath.trim(),
        inSec: clampInSec(c.inSec),
        outSec: normalizeOutSec(c.outSec),
        sourceNodeId: c.sourceNodeId?.trim() || undefined,
        label: c.label?.trim() || undefined,
        scriptBeatId: c.scriptBeatId?.trim() || undefined,
      }));
  }

  const legacy = data.inputs;
  if (!Array.isArray(legacy) || legacy.length === 0) return [];

  return legacy
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean)
    .map((relPath, index) => ({
      id: `legacy-${index}-${relPath}`,
      relPath,
      inSec: 0,
      outSec: null,
    }));
}

export function composeClipToTimeline(clip: ComposeClip): ComposeTimelineClip {
  return {
    id: newTimelineClipId(),
    relPath: clip.relPath,
    inSec: 0,
    outSec: null,
    sourceNodeId: clip.sourceNodeId,
    label: clip.label,
    scriptBeatId: clip.scriptBeatId,
  };
}

/** 写回节点时同步 legacy `inputs` 供旧面板/Inspector 读取 */
export function timelineClipsToNodePatch(clips: ComposeTimelineClip[]): Pick<FlowNodeData, "timelineClips" | "inputs"> {
  return {
    timelineClips: clips,
    inputs: clips.map((c) => c.relPath),
  };
}

export function clipEffectiveDurationSec(
  clip: ComposeTimelineClip,
  durations: Record<string, number>,
): number {
  const full = durations[clip.relPath];
  const end =
    clip.outSec != null && Number.isFinite(clip.outSec)
      ? clip.outSec
      : full && full > 0
        ? full
        : TIMELINE_FALLBACK_CLIP_SEC;
  return Math.max(0.05, end - clampInSec(clip.inSec));
}

export function clipsToRenderPayload(
  clips: ComposeTimelineClip[],
  durations: Record<string, number>,
): TimelineRenderClipPayload[] {
  return clips.map((c) => {
    const full = durations[c.relPath];
    const outSec =
      c.outSec != null && Number.isFinite(c.outSec)
        ? c.outSec
        : full && full > 0
          ? full
          : null;
    return {
      relPath: c.relPath,
      inSec: clampInSec(c.inSec),
      outSec,
    };
  });
}

function clampInSec(v: unknown): number {
  const n = typeof v === "number" ? v : 0;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** 时间线片段角标文案 */
export function clipDisplayLabel(clip: ComposeTimelineClip): string {
  if (clip.label?.trim()) return clip.label.trim();
  const name = clip.relPath.split("/").pop() ?? clip.relPath;
  return name.length > 14 ? `${name.slice(0, 12)}…` : name;
}

function normalizeOutSec(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}
