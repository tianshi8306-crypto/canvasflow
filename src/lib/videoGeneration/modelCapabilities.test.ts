import { describe, it, expect } from "vitest";
import {
  clampVideoDurationForModel,
  isCatalogResolutionSupported,
  normalizeVideoOutputForModel,
} from "./modelCapabilities";

describe("video model capabilities", () => {
  it("rejects 480P for Seedance models", () => {
    expect(isCatalogResolutionSupported("doubao_seedance_2_0", "480P")).toBe(false);
    expect(isCatalogResolutionSupported("doubao_seedance_2_0", "720P")).toBe(true);
  });

  it("clamps duration to 4-15s", () => {
    expect(clampVideoDurationForModel("doubao_seedance_2_0", 2)).toBe(4);
    expect(clampVideoDurationForModel("doubao_seedance_2_0", 20)).toBe(15);
    expect(clampVideoDurationForModel("doubao_seedance_2_0", -1)).toBe(-1);
  });

  it("normalizes invalid resolution in draft output", () => {
    const r = normalizeVideoOutputForModel("doubao_seedance_2_0", {
      aspectRatio: "16:9",
      resolution: "480P",
      durationSec: 5,
      generateAudio: true,
    });
    expect(r.adjusted).toBe(true);
    expect(r.output.resolution).toBe("720P");
  });
});
