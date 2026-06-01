import { clipFileEndSec, fileTimeAtPlayhead } from "@/lib/compose/timelineEditOps";
import type { ComposeTimelineClip } from "@/lib/compose/timelineClips";
import type { TimelineSegment } from "@/lib/compose/timelineLayout";

/** 吸附判定距离（时间线条带像素） */
export const TIMELINE_SNAP_THRESHOLD_PX = 8;

export type TimelineSnapOptions = {
  enabled: boolean;
  /** 全局时间轴上的吸附阈值（秒） */
  thresholdSec: number;
  playheadSec: number;
};

export function snapThresholdSec(pxPerSec: number): number {
  if (!Number.isFinite(pxPerSec) || pxPerSec <= 0) return 0.5;
  return TIMELINE_SNAP_THRESHOLD_PX / pxPerSec;
}

/** 刻度尺整秒吸附点：0, 1, 2, … 直至时间线总长 */
export function collectWholeSecondSnapTargets(totalSec: number): number[] {
  if (totalSec <= 0) return [0];
  const max = Math.ceil(totalSec);
  const targets: number[] = [];
  for (let t = 0; t <= max; t++) targets.push(t);
  return targets;
}

/** 时间线全局吸附点：整秒刻度 + 各片段入出边界 */
export function collectTimelineSnapTargets(
  segments: TimelineSegment[],
  totalSec: number,
): number[] {
  const targets = new Set<number>([0]);
  for (const t of collectWholeSecondSnapTargets(totalSec)) {
    targets.add(t);
  }
  for (const seg of segments) {
    targets.add(seg.startSec);
    targets.add(seg.startSec + seg.durationSec);
  }
  return [...targets].sort((a, b) => a - b);
}

export function snapToNearestSec(
  sec: number,
  targets: number[],
  thresholdSec: number,
): { sec: number; snapped: boolean } {
  if (targets.length === 0 || thresholdSec <= 0) {
    return { sec, snapped: false };
  }
  let best = sec;
  let bestDist = thresholdSec + 1;
  for (const t of targets) {
    const d = Math.abs(t - sec);
    if (d <= thresholdSec && d < bestDist) {
      bestDist = d;
      best = t;
    }
  }
  return { sec: best, snapped: best !== sec };
}

export function snapPlayheadSec(
  sec: number,
  segments: TimelineSegment[],
  totalSec: number,
  opts: TimelineSnapOptions,
): { sec: number; snapped: boolean } {
  if (!opts.enabled || segments.length === 0) {
    return { sec, snapped: false };
  }
  const targets = collectTimelineSnapTargets(segments, totalSec);
  return snapToNearestSec(sec, targets, opts.thresholdSec);
}

/** 裁切拖拽：源文件时间吸附入点、出点、播放头（若在选中片段内） */
export function collectTrimSnapFileTimes(
  clip: ComposeTimelineClip,
  seg: TimelineSegment,
  playheadSec: number,
  durations: Record<string, number>,
): number[] {
  const targets = new Set<number>([clip.inSec, clipFileEndSec(clip, durations)]);
  const segEnd = seg.startSec + seg.durationSec;
  if (playheadSec >= seg.startSec - 1e-6 && playheadSec <= segEnd + 1e-6) {
    const offset = Math.max(0, Math.min(seg.durationSec, playheadSec - seg.startSec));
    targets.add(fileTimeAtPlayhead(clip, offset));
  }
  return [...targets].sort((a, b) => a - b);
}

export function snapTrimFileTime(
  fileSec: number,
  clip: ComposeTimelineClip,
  seg: TimelineSegment,
  durations: Record<string, number>,
  opts: TimelineSnapOptions,
): number {
  if (!opts.enabled) return fileSec;
  const targets = collectTrimSnapFileTimes(clip, seg, opts.playheadSec, durations);
  return snapToNearestSec(fileSec, targets, opts.thresholdSec).sec;
}
