import { describe, expect, it } from "vitest";
import { waveformDecodeBins } from "@/lib/audioWaveformBins";

describe("waveformDecodeBins", () => {
  it("scales with duration within clamp", () => {
    expect(waveformDecodeBins(3)).toBe(96);
    expect(waveformDecodeBins(10)).toBe(120);
    expect(waveformDecodeBins(60)).toBe(480);
    expect(waveformDecodeBins(120)).toBe(480);
  });

  it("falls back when duration unknown", () => {
    expect(waveformDecodeBins(0)).toBe(200);
    expect(waveformDecodeBins(Number.NaN)).toBe(200);
  });
});
