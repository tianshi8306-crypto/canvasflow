import { describe, expect, it } from "vitest";
import { defaultVideoSubtitleRegion, normalizeVideoSubtitleRegion } from "./videoSubtitleRegion";

describe("videoSubtitleRegion", () => {
  it("provides bottom band default", () => {
    const d = defaultVideoSubtitleRegion();
    expect(d.y).toBeGreaterThan(0.7);
    expect(d.h).toBeGreaterThan(0.05);
  });

  it("clamps region into unit square", () => {
    const n = normalizeVideoSubtitleRegion({ x: -0.2, y: 0.95, w: 0.9, h: 0.2 });
    expect(n.x).toBeGreaterThanOrEqual(0);
    expect(n.y + n.h).toBeLessThanOrEqual(1);
  });
});
