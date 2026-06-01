import type { ComposeTimelineClip } from "@/lib/compose/timelineClips";
import { clipEffectiveDurationSec } from "@/lib/compose/timelineClips";

export const TIMELINE_PX_PER_SEC = 18;
export const TIMELINE_MIN_CLIP_WIDTH = 72;
export const TIMELINE_MAX_CLIP_WIDTH = 280;
export const TIMELINE_DEFAULT_CLIP_WIDTH = 100;
/** 无元数据时长时用于刻度/播放头的估算秒数 */
export const TIMELINE_FALLBACK_CLIP_SEC = 5;

export type TimelineSegment = {
  path: string;
  clipId: string;
  index: number;
  startSec: number;
  durationSec: number;
  widthPx: number;
  /** 源文件内入点（预览 seek 用） */
  inSec: number;
};

/** 片段左缘在时间线条带内的 x（像素） */
export function segmentStartPx(
  segments: TimelineSegment[],
  index: number,
  clipGapPx = 0,
): number {
  let x = 0;
  for (const seg of segments) {
    if (seg.index === index) return x;
    x += seg.widthPx + clipGapPx;
  }
  return x;
}

export function segmentWidthPx(durationSec: number, pxPerSec = TIMELINE_PX_PER_SEC): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    return TIMELINE_DEFAULT_CLIP_WIDTH;
  }
  return Math.min(
    TIMELINE_MAX_CLIP_WIDTH,
    Math.max(TIMELINE_MIN_CLIP_WIDTH, Math.round(durationSec * pxPerSec)),
  );
}

/** @deprecated 使用 buildTimelineLayoutFromClips */
export function buildTimelineLayout(
  paths: string[],
  durations: Record<string, number>,
  pxPerSec = TIMELINE_PX_PER_SEC,
  clipGapPx = 0,
): { segments: TimelineSegment[]; totalSec: number; totalWidthPx: number } {
  const clips: ComposeTimelineClip[] = paths.map((relPath, index) => ({
    id: `path-${index}`,
    relPath,
    inSec: 0,
    outSec: null,
  }));
  return buildTimelineLayoutFromClips(clips, durations, pxPerSec, clipGapPx);
}

export function buildTimelineLayoutFromClips(
  clips: ComposeTimelineClip[],
  durations: Record<string, number>,
  pxPerSec = TIMELINE_PX_PER_SEC,
  clipGapPx = 0,
): { segments: TimelineSegment[]; totalSec: number; totalWidthPx: number } {
  const segments: TimelineSegment[] = [];
  let startSec = 0;
  let totalWidthPx = 0;

  for (let index = 0; index < clips.length; index++) {
    const clip = clips[index]!;
    const path = clip.relPath;
    const durationSec = clipEffectiveDurationSec(clip, durations);
    const widthPx = segmentWidthPx(durationSec, pxPerSec);
    segments.push({
      path,
      clipId: clip.id,
      index,
      startSec,
      durationSec,
      widthPx,
      inSec: clip.inSec,
    });
    startSec += durationSec;
    totalWidthPx += widthPx;
  }

  const gap = Math.max(0, clips.length - 1) * clipGapPx;
  return { segments, totalSec: startSec, totalWidthPx: totalWidthPx + gap };
}

export function resolveSecToClip(
  segments: TimelineSegment[],
  sec: number,
): { index: number; offsetInClip: number } {
  if (segments.length === 0) return { index: 0, offsetInClip: 0 };
  const clamped = Math.max(0, sec);
  for (const seg of segments) {
    if (clamped < seg.startSec + seg.durationSec) {
      return {
        index: seg.index,
        offsetInClip: Math.max(0, clamped - seg.startSec),
      };
    }
  }
  const last = segments[segments.length - 1]!;
  return { index: last.index, offsetInClip: last.durationSec };
}

/** 根据时间线条带内 x 坐标（含 clip gap）求全局时间 */
export function resolveSecFromTrackX(
  segments: TimelineSegment[],
  xPx: number,
  clipGapPx = 0,
): number {
  if (segments.length === 0 || xPx <= 0) return 0;
  let x = xPx;
  for (const seg of segments) {
    if (x <= seg.widthPx) {
      const ratio = seg.widthPx > 0 ? x / seg.widthPx : 0;
      return seg.startSec + ratio * seg.durationSec;
    }
    x -= seg.widthPx + clipGapPx;
  }
  const last = segments[segments.length - 1]!;
  return last.startSec + last.durationSec;
}
