import {
  newTimelineClipId,
  type ComposeTimelineClip,
} from "@/lib/compose/timelineClips";
import {
  buildTimelineLayoutFromClips,
  resolveSecToClip,
  segmentStartPx,
  TIMELINE_FALLBACK_CLIP_SEC,
  type TimelineSegment,
} from "@/lib/compose/timelineLayout";
import type { TimelineSnapOptions } from "@/lib/compose/timelineSnap";
import {
  collectTimelineSnapTargets,
  snapToNearestSec,
  snapTrimFileTime,
} from "@/lib/compose/timelineSnap";

export const MIN_CLIP_SEC = 0.05;

export type TimelineEditResult = {
  clips: ComposeTimelineClip[];
  selectedIndex: number;
  playheadSec: number;
};

export type TimelineEditError = { error: string };

export function clipFileEndSec(
  clip: ComposeTimelineClip,
  durations: Record<string, number>,
): number {
  if (clip.outSec != null && Number.isFinite(clip.outSec)) return clip.outSec;
  const d = durations[clip.relPath];
  return d && d > 0 ? d : TIMELINE_FALLBACK_CLIP_SEC;
}

/** 播放头在源文件中的绝对时间（秒） */
export function fileTimeAtPlayhead(
  clip: ComposeTimelineClip,
  offsetInTimelineSec: number,
): number {
  return clip.inSec + Math.max(0, offsetInTimelineSec);
}

export function splitAtPlayhead(
  clips: ComposeTimelineClip[],
  segments: TimelineSegment[],
  playheadSec: number,
  durations: Record<string, number>,
): TimelineEditResult | TimelineEditError {
  if (clips.length === 0 || segments.length === 0) {
    return { error: "时间线为空" };
  }
  const { index, offsetInClip } = resolveSecToClip(segments, playheadSec);
  const clip = clips[index];
  const seg = segments[index];
  if (!clip || !seg) return { error: "未找到片段" };

  const fileSplit = fileTimeAtPlayhead(clip, offsetInClip);
  const fileEnd = clipFileEndSec(clip, durations);

  if (fileSplit - clip.inSec < MIN_CLIP_SEC || fileEnd - fileSplit < MIN_CLIP_SEC) {
    return { error: "播放头太靠近片段边缘，无法分割" };
  }

  const left: ComposeTimelineClip = { ...clip, outSec: fileSplit };
  const right: ComposeTimelineClip = {
    ...clip,
    id: newTimelineClipId(),
    inSec: fileSplit,
    outSec: clip.outSec,
  };

  const next = [...clips];
  next.splice(index, 1, left, right);

  return {
    clips: next,
    selectedIndex: index + 1,
    playheadSec: seg.startSec + offsetInClip,
  };
}

export function trimSelectedInAtPlayhead(
  clips: ComposeTimelineClip[],
  segments: TimelineSegment[],
  selectedIndex: number,
  playheadSec: number,
  durations: Record<string, number>,
): TimelineEditResult | TimelineEditError {
  const clip = clips[selectedIndex];
  const seg = segments.find((s) => s.index === selectedIndex);
  if (!clip || !seg) return { error: "请先选中片段" };

  if (playheadSec < seg.startSec || playheadSec >= seg.startSec + seg.durationSec) {
    return { error: "播放头不在选中片段内" };
  }

  const offsetInClip = playheadSec - seg.startSec;
  const newIn = fileTimeAtPlayhead(clip, offsetInClip);
  const fileEnd = clipFileEndSec(clip, durations);

  if (fileEnd - newIn < MIN_CLIP_SEC) {
    return { error: "修剪后片段过短" };
  }

  const next = [...clips];
  next[selectedIndex] = { ...clip, inSec: newIn };

  return {
    clips: next,
    selectedIndex,
    playheadSec,
  };
}

export function trimSelectedOutAtPlayhead(
  clips: ComposeTimelineClip[],
  segments: TimelineSegment[],
  selectedIndex: number,
  playheadSec: number,
  _durations: Record<string, number>,
): TimelineEditResult | TimelineEditError {
  const clip = clips[selectedIndex];
  const seg = segments.find((s) => s.index === selectedIndex);
  if (!clip || !seg) return { error: "请先选中片段" };

  if (playheadSec < seg.startSec || playheadSec >= seg.startSec + seg.durationSec) {
    return { error: "播放头不在选中片段内" };
  }

  const offsetInClip = playheadSec - seg.startSec;
  const newOut = fileTimeAtPlayhead(clip, offsetInClip);

  if (newOut - clip.inSec < MIN_CLIP_SEC) {
    return { error: "修剪后片段过短" };
  }

  const next = [...clips];
  next[selectedIndex] = { ...clip, outSec: newOut };

  return {
    clips: next,
    selectedIndex,
    playheadSec,
  };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** 时间线条带 x → 源文件内时间 */
export function fileTimeAtTrackPx(
  clip: ComposeTimelineClip,
  seg: TimelineSegment,
  segments: TimelineSegment[],
  trackPx: number,
  durations: Record<string, number>,
  clipGapPx = 0,
): number {
  const startPx = segmentStartPx(segments, seg.index, clipGapPx);
  const localPx = trackPx - startPx;
  const ratio = seg.widthPx > 0 ? clamp01(localPx / seg.widthPx) : 0;
  const fileEnd = clipFileEndSec(clip, durations);
  return clip.inSec + ratio * Math.max(MIN_CLIP_SEC, fileEnd - clip.inSec);
}

export function applyTrimInDrag(
  clip: ComposeTimelineClip,
  newInSec: number,
  durations: Record<string, number>,
): ComposeTimelineClip | TimelineEditError {
  const fileEnd = clipFileEndSec(clip, durations);
  const inSec = Math.max(0, Math.min(newInSec, fileEnd - MIN_CLIP_SEC));
  if (fileEnd - inSec < MIN_CLIP_SEC) {
    return { error: "片段过短" };
  }
  return { ...clip, inSec };
}

export function applyTrimOutDrag(
  clip: ComposeTimelineClip,
  newOutSec: number,
  durations: Record<string, number>,
): ComposeTimelineClip | TimelineEditError {
  const fileEnd = clipFileEndSec(clip, durations);
  const outSec = Math.max(clip.inSec + MIN_CLIP_SEC, Math.min(newOutSec, fileEnd));
  if (outSec - clip.inSec < MIN_CLIP_SEC) {
    return { error: "片段过短" };
  }
  return { ...clip, outSec };
}

export function trimDragFromTrackPx(
  clips: ComposeTimelineClip[],
  segments: TimelineSegment[],
  index: number,
  edge: "in" | "out",
  trackPx: number,
  durations: Record<string, number>,
  snap?: TimelineSnapOptions,
): TimelineEditResult | TimelineEditError {
  const clip = clips[index];
  const seg = segments.find((s) => s.index === index);
  if (!clip || !seg) return { error: "未找到片段" };

  let fileT = fileTimeAtTrackPx(clip, seg, segments, trackPx, durations);
  if (snap?.enabled) {
    const startPx = segmentStartPx(segments, index);
    const localPx = trackPx - startPx;
    const ratio = seg.widthPx > 0 ? Math.max(0, Math.min(1, localPx / seg.widthPx)) : 0;
    const globalSec = seg.startSec + ratio * seg.durationSec;
    const { segments: layoutSegs, totalSec } = buildTimelineLayoutFromClips(clips, durations);
    const targets = collectTimelineSnapTargets(layoutSegs, totalSec);
    const { sec: snappedGlobal } = snapToNearestSec(globalSec, targets, snap.thresholdSec);
    const offsetInClip = Math.max(0, Math.min(seg.durationSec, snappedGlobal - seg.startSec));
    fileT = fileTimeAtPlayhead(clip, offsetInClip);
    fileT = snapTrimFileTime(fileT, clip, seg, durations, snap);
  }
  const updated =
    edge === "in"
      ? applyTrimInDrag(clip, fileT, durations)
      : applyTrimOutDrag(clip, fileT, durations);

  if ("error" in updated) return updated;

  const next = [...clips];
  next[index] = updated;
  const { segments: segs2 } = buildTimelineLayoutFromClips(next, durations);
  const seg2 = segs2.find((s) => s.index === index) ?? seg;
  const playhead =
    edge === "in" ? seg2.startSec : Math.max(seg2.startSec, seg2.startSec + seg2.durationSec - 0.001);

  return {
    clips: next,
    selectedIndex: index,
    playheadSec: playhead,
  };
}
