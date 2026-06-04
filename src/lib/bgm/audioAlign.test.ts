import { describe, it, expect } from "vitest";
import {
  computeBgmLoopLayout,
  buildBgmOverlayArgs,
  DEFAULT_BGM_ALIGN,
  type BgmAlignSettings,
} from "@/lib/bgm/audioAlign";

describe("computeBgmLoopLayout", () => {
  it("returns null for invalid durations", () => {
    expect(computeBgmLoopLayout(0, 30, DEFAULT_BGM_ALIGN)).toBeNull();
    expect(computeBgmLoopLayout(-1, 30, DEFAULT_BGM_ALIGN)).toBeNull();
    expect(computeBgmLoopLayout(30, 0, DEFAULT_BGM_ALIGN)).toBeNull();
    expect(computeBgmLoopLayout(NaN, 30, DEFAULT_BGM_ALIGN)).toBeNull();
  });

  it("no loop when bgm is longer than video", () => {
    const layout = computeBgmLoopLayout(30, 60, DEFAULT_BGM_ALIGN);
    expect(layout).not.toBeNull();
    expect(layout!.loopCount).toBe(1);
    expect(layout!.bgmDurationSec).toBe(60);
    expect(layout!.videoDurationSec).toBe(30);
  });

  it("auto loop when loopToFit is true", () => {
    const layout = computeBgmLoopLayout(80, 30, DEFAULT_BGM_ALIGN);
    expect(layout).not.toBeNull();
    expect(layout!.loopCount).toBe(3); // ceil(80/30) = 3
  });

  it("no loop when loopToFit is false", () => {
    const settings: BgmAlignSettings = { ...DEFAULT_BGM_ALIGN, loopToFit: false };
    const layout = computeBgmLoopLayout(80, 30, settings);
    expect(layout).not.toBeNull();
    expect(layout!.loopCount).toBe(1);
  });

  it("exact match needs no loop", () => {
    const layout = computeBgmLoopLayout(30, 30, DEFAULT_BGM_ALIGN);
    expect(layout).not.toBeNull();
    expect(layout!.loopCount).toBe(1);
  });

  it("calculates fade out start correctly", () => {
    const layout = computeBgmLoopLayout(60, 20, { ...DEFAULT_BGM_ALIGN, fadeOutSec: 3 });
    expect(layout).not.toBeNull();
    expect(layout!.fadeOutStartSec).toBeCloseTo(57, 0); // 60 - 3 = 57
  });
});

describe("buildBgmOverlayArgs", () => {
  it("generates valid filter_complex with audio mix", () => {
    const result = buildBgmOverlayArgs(DEFAULT_BGM_ALIGN, 60, true);
    expect(result.filterComplex).toContain("[1:a]");
    expect(result.filterComplex).toContain("[bgm]");
    expect(result.filterComplex).toContain("[0:a]");
    expect(result.filterComplex).toContain("[orig]");
    expect(result.filterComplex).toContain("amix=inputs=2");
    expect(result.filterComplex).toContain("[outa]");
    expect(result.streamLoop).toBe("-1");
  });

  it("replaces original audio when keepOriginalAudio is false", () => {
    const settings: BgmAlignSettings = {
      ...DEFAULT_BGM_ALIGN,
      keepOriginalAudio: false,
    };
    const result = buildBgmOverlayArgs(settings, 60, false);
    expect(result.filterComplex).not.toContain("[orig]");
    expect(result.filterComplex).toContain("anull");
    expect(result.streamLoop).toBe("0");
  });

  it("includes fade in filter", () => {
    const settings: BgmAlignSettings = { ...DEFAULT_BGM_ALIGN, fadeInSec: 2.0 };
    const result = buildBgmOverlayArgs(settings, 60, true);
    expect(result.filterComplex).toContain("afade=t=in");
    expect(result.filterComplex).toContain("d=2.00");
  });

  it("includes fade out filter on mix output", () => {
    const settings: BgmAlignSettings = { ...DEFAULT_BGM_ALIGN, fadeOutSec: 3.0 };
    const result = buildBgmOverlayArgs(settings, 60, true);
    expect(result.filterComplex).toContain("afade=t=out");
    expect(result.filterComplex).toContain("d=3.00");
  });

  it("handles zero fade", () => {
    const settings: BgmAlignSettings = {
      ...DEFAULT_BGM_ALIGN,
      fadeInSec: 0,
      fadeOutSec: 0,
    };
    const result = buildBgmOverlayArgs(settings, 60, false);
    expect(result.filterComplex).not.toContain("afade");
  });

  it("applies volume correctly", () => {
    const settings: BgmAlignSettings = { ...DEFAULT_BGM_ALIGN, bgmVolume: 0.5 };
    const result = buildBgmOverlayArgs(settings, 60, true);
    expect(result.filterComplex).toContain("volume=0.500");
  });
});
