import { describe, expect, it } from "vitest";
import { splitAtPlayhead, trimSelectedInAtPlayhead, trimSelectedOutAtPlayhead } from "./timelineEditOps";
import { buildTimelineLayoutFromClips } from "./timelineLayout";

describe("splitAtPlayhead", () => {
  it("splits one clip into two at playhead", () => {
    const clips = [{ id: "a", relPath: "v.mp4", inSec: 0, outSec: null }];
    const durations = { "v.mp4": 10 };
    const { segments } = buildTimelineLayoutFromClips(clips, durations);
    const result = splitAtPlayhead(clips, segments, 4, durations);
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.clips).toHaveLength(2);
    expect(result.clips[0]!.outSec).toBe(4);
    expect(result.clips[1]!.inSec).toBe(4);
    expect(result.clips[1]!.outSec).toBeNull();
  });

  it("rejects split at edge", () => {
    const clips = [{ id: "a", relPath: "v.mp4", inSec: 0, outSec: 5 }];
    const durations = { "v.mp4": 10 };
    const { segments } = buildTimelineLayoutFromClips(clips, durations);
    const result = splitAtPlayhead(clips, segments, 0, durations);
    expect("error" in result).toBe(true);
  });
});

describe("trim at playhead", () => {
  const clips = [{ id: "a", relPath: "v.mp4", inSec: 0, outSec: null }];
  const durations = { "v.mp4": 10 };
  const { segments } = buildTimelineLayoutFromClips(clips, durations);

  it("trim in sets inSec to playhead file time", () => {
    const result = trimSelectedInAtPlayhead(clips, segments, 0, 3, durations);
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.clips[0]!.inSec).toBe(3);
  });

  it("trim out sets outSec to playhead file time", () => {
    const result = trimSelectedOutAtPlayhead(clips, segments, 0, 7, durations);
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.clips[0]!.outSec).toBe(7);
  });
});
