import { describe, expect, it } from "vitest";
import {
  NUDGE_STEP_LARGE_PX,
  NUDGE_STEP_PX,
  nudgeDeltaFromArrowKey,
} from "@/lib/nodeCanvasNudge";

describe("nudgeDeltaFromArrowKey", () => {
  it("returns 1px deltas by default", () => {
    expect(nudgeDeltaFromArrowKey("ArrowRight", false)).toEqual({ dx: NUDGE_STEP_PX, dy: 0 });
    expect(nudgeDeltaFromArrowKey("ArrowUp", false)).toEqual({ dx: 0, dy: -NUDGE_STEP_PX });
  });

  it("returns 10px deltas with shift", () => {
    expect(nudgeDeltaFromArrowKey("ArrowLeft", true)).toEqual({
      dx: -NUDGE_STEP_LARGE_PX,
      dy: 0,
    });
  });

  it("returns null for non-arrow keys", () => {
    expect(nudgeDeltaFromArrowKey("Enter", false)).toBeNull();
  });
});
