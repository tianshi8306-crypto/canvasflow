import { describe, expect, it } from "vitest";
import { createTimelineHistory } from "./timelineHistory";

const snap = (n: number) => ({
  clips: [{ id: "1", relPath: "a.mp4", inSec: 0, outSec: null as number | null }],
  selectedIndex: 0,
  playheadSec: n,
});

describe("createTimelineHistory", () => {
  it("undo restores previous snapshot", () => {
    const h = createTimelineHistory();
    h.push(snap(0));
    const restored = h.undo(snap(5));
    expect(restored?.playheadSec).toBe(0);
    expect(h.canRedo()).toBe(true);
  });

  it("redo after undo", () => {
    const h = createTimelineHistory();
    h.push(snap(0));
    h.undo(snap(5));
    const again = h.redo(snap(0));
    expect(again?.playheadSec).toBe(5);
  });
});
