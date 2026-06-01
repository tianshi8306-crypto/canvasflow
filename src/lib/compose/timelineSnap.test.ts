import { describe, expect, it } from "vitest";
import {
  collectTimelineSnapTargets,
  collectWholeSecondSnapTargets,
  snapPlayheadSec,
  snapThresholdSec,
  snapTrimFileTime,
  TIMELINE_SNAP_THRESHOLD_PX,
} from "./timelineSnap";
import type { TimelineSegment } from "./timelineLayout";
import type { ComposeTimelineClip } from "./timelineClips";

const segments: TimelineSegment[] = [
  { path: "a.mp4", clipId: "1", index: 0, startSec: 0, durationSec: 4, widthPx: 72, inSec: 0 },
  { path: "b.mp4", clipId: "2", index: 1, startSec: 4, durationSec: 3, widthPx: 54, inSec: 0 },
];

describe("timelineSnap", () => {
  it("collects whole seconds and segment boundaries", () => {
    expect(collectWholeSecondSnapTargets(7)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(collectTimelineSnapTargets(segments, 7)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("snapThresholdSec scales with zoom", () => {
    expect(snapThresholdSec(18)).toBeCloseTo(TIMELINE_SNAP_THRESHOLD_PX / 18);
  });

  it("snaps playhead to whole second", () => {
    const { sec, snapped } = snapPlayheadSec(2.08, segments, 7, {
      enabled: true,
      thresholdSec: 0.5,
      playheadSec: 0,
    });
    expect(snapped).toBe(true);
    expect(sec).toBe(2);
  });

  it("snaps playhead near clip start", () => {
    const { sec, snapped } = snapPlayheadSec(4.05, segments, 7, {
      enabled: true,
      thresholdSec: 0.5,
      playheadSec: 0,
    });
    expect(snapped).toBe(true);
    expect(sec).toBe(4);
  });

  it("does not snap when disabled", () => {
    const { sec, snapped } = snapPlayheadSec(4.05, segments, 7, {
      enabled: false,
      thresholdSec: 0.5,
      playheadSec: 0,
    });
    expect(snapped).toBe(false);
    expect(sec).toBe(4.05);
  });

  it("snaps trim in to playhead file time", () => {
    const clip: ComposeTimelineClip = {
      id: "1",
      relPath: "a.mp4",
      inSec: 0,
      outSec: 10,
    };
    const seg = segments[0]!;
    const snapped = snapTrimFileTime(
      2.02,
      clip,
      seg,
      { "a.mp4": 10 },
      { enabled: true, thresholdSec: 0.5, playheadSec: 2 },
    );
    expect(snapped).toBe(2);
  });
});
