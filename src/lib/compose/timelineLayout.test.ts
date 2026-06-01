import { describe, expect, it } from "vitest";
import {
  buildTimelineLayout,
  resolveSecFromTrackX,
  resolveSecToClip,
} from "./timelineLayout";

describe("buildTimelineLayout", () => {
  it("sums segment durations", () => {
    const { segments, totalSec } = buildTimelineLayout(
      ["a.mp4", "b.mp4"],
      { "a.mp4": 10, "b.mp4": 5 },
    );
    expect(segments).toHaveLength(2);
    expect(totalSec).toBe(15);
    expect(segments[1]!.startSec).toBe(10);
  });
});

describe("resolveSecToClip", () => {
  it("maps global sec to clip index", () => {
    const { segments } = buildTimelineLayout(["a", "b"], { a: 10, b: 5 });
    expect(resolveSecToClip(segments, 12)).toEqual({ index: 1, offsetInClip: 2 });
  });
});

describe("resolveSecFromTrackX", () => {
  it("maps x to sec within first clip", () => {
    const { segments } = buildTimelineLayout(["a"], { a: 10 });
    const sec = resolveSecFromTrackX(segments, segments[0]!.widthPx / 2);
    expect(sec).toBeGreaterThan(4);
    expect(sec).toBeLessThan(6);
  });
});
