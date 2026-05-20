import { describe, expect, it } from "vitest";
import { estimateImageGenerationCost } from "./estimateCost";

describe("estimateImageGenerationCost", () => {
  it("scales with count and resolution", () => {
    const low = estimateImageGenerationCost({
      count: 1,
      resolutionId: "1024x1024",
      task: "text_to_image",
    });
    const high = estimateImageGenerationCost({
      count: 2,
      resolutionId: "2048x2048",
      task: "multi_ref_fusion",
    });
    expect(low).toMatch(/约 ¥/);
    expect(parseFloat(high.replace(/[^\d.]/g, ""))).toBeGreaterThan(
      parseFloat(low.replace(/[^\d.]/g, "")),
    );
  });
});
