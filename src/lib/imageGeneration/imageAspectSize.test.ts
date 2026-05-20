import { describe, expect, it } from "vitest";
import {
  computeImageNodeFrameSize,
  resolveImageApiSize,
  resolveImageNodeFrameRatio,
} from "./imageAspectSize";

describe("imageAspectSize", () => {
  it("resolves 16:9 at 2K short edge", () => {
    expect(resolveImageApiSize("16:9", "2K")).toBe("3641x2048");
  });

  it("uses image dimensions for auto aspect", () => {
    expect(resolveImageApiSize("auto", "1K", 1080, 1080)).toBe("1024x1024");
  });

  it("frame matches image ratio without letterboxing math", () => {
    const ratio = resolveImageNodeFrameRatio({
      aspectId: "16:9",
      imageWidth: 1920,
      imageHeight: 1080,
    });
    const frame = computeImageNodeFrameSize(ratio);
    expect(frame.width / frame.height).toBeCloseTo(16 / 9, 2);
  });
});
