import { describe, expect, it } from "vitest";
import { trimDragFromTrackPx } from "./timelineEditOps";
import { buildTimelineLayoutFromClips } from "./timelineLayout";

describe("trimDragFromTrackPx", () => {
  const clips = [{ id: "a", relPath: "v.mp4", inSec: 0, outSec: null }];
  const durations = { "v.mp4": 10 };

  it("trim in shrinks from left", () => {
    const { segments } = buildTimelineLayoutFromClips(clips, durations);
    const startPx = 0;
    const midPx = segments[0]!.widthPx * 0.15;
    const result = trimDragFromTrackPx(clips, segments, 0, "in", startPx + midPx, durations);
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.clips[0]!.inSec).toBeGreaterThan(0);
    expect(result.clips[0]!.inSec).toBeLessThan(8);
  });

  it("trim out shrinks from right", () => {
    const { segments } = buildTimelineLayoutFromClips(clips, durations);
    const endPx = segments[0]!.widthPx * 0.7;
    const result = trimDragFromTrackPx(clips, segments, 0, "out", endPx, durations);
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.clips[0]!.outSec).toBeLessThan(10);
    expect(result.clips[0]!.outSec!).toBeGreaterThan(5);
  });
});
