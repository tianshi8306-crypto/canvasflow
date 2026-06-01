import { describe, expect, it } from "vitest";
import {
  clipEffectiveDurationSec,
  clipsToRenderPayload,
  normalizeTimelineClips,
} from "./timelineClips";
import { buildTimelineLayoutFromClips } from "./timelineLayout";

describe("normalizeTimelineClips", () => {
  it("migrates legacy inputs", () => {
    const clips = normalizeTimelineClips({
      inputs: ["a.mp4", "b.mp4"],
    });
    expect(clips).toHaveLength(2);
    expect(clips[0]!.relPath).toBe("a.mp4");
    expect(clips[0]!.inSec).toBe(0);
    expect(clips[0]!.outSec).toBeNull();
  });

  it("prefers timelineClips over inputs", () => {
    const clips = normalizeTimelineClips({
      timelineClips: [
        { id: "1", relPath: "x.mp4", inSec: 2, outSec: 8 },
      ],
      inputs: ["legacy.mp4"],
    });
    expect(clips).toHaveLength(1);
    expect(clips[0]!.inSec).toBe(2);
    expect(clips[0]!.outSec).toBe(8);
  });
});

describe("clipEffectiveDurationSec", () => {
  it("uses outSec when set", () => {
    const d = clipEffectiveDurationSec(
      { id: "1", relPath: "a.mp4", inSec: 1, outSec: 4 },
      { "a.mp4": 10 },
    );
    expect(d).toBe(3);
  });
});

describe("clipsToRenderPayload", () => {
  it("fills outSec from duration map when null", () => {
    const payload = clipsToRenderPayload(
      [{ id: "1", relPath: "a.mp4", inSec: 0, outSec: null }],
      { "a.mp4": 12 },
    );
    expect(payload[0]!.outSec).toBe(12);
  });
});

describe("buildTimelineLayoutFromClips", () => {
  it("respects in/out for segment width", () => {
    const { totalSec } = buildTimelineLayoutFromClips(
      [{ id: "1", relPath: "a.mp4", inSec: 0, outSec: 3 }],
      { "a.mp4": 10 },
    );
    expect(totalSec).toBe(3);
  });
});
