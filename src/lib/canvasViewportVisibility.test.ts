import { describe, expect, it } from "vitest";
import { flowRectsIntersect } from "@/lib/canvasViewportVisibility";

describe("flowRectsIntersect", () => {
  it("returns true when rects overlap", () => {
    expect(
      flowRectsIntersect(
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 50, y: 50, width: 100, height: 100 },
      ),
    ).toBe(true);
  });

  it("returns false when rects are disjoint", () => {
    expect(
      flowRectsIntersect(
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 20, y: 20, width: 10, height: 10 },
      ),
    ).toBe(false);
  });
});
