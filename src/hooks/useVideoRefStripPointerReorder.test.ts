import { describe, expect, it } from "vitest";
import { findRefStripDropTargetAt } from "./useVideoRefStripPointerReorder";

function mockThumb(_edgeId: string, left: number, width = 40, top = 100, height = 40): HTMLDivElement {
  const el = document.createElement("div");
  el.getBoundingClientRect = () =>
    ({
      left,
      right: left + width,
      top,
      bottom: top + height,
      width,
      height,
      x: left,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect;
  return el;
}

describe("findRefStripDropTargetAt", () => {
  it("picks closest thumb center by horizontal distance", () => {
    const map = new Map<string, HTMLDivElement>([
      ["a", mockThumb("a", 0)],
      ["b", mockThumb("b", 50)],
      ["c", mockThumb("c", 100)],
    ]);
    expect(findRefStripDropTargetAt(map, "a", 55, 120)).toBe("b");
    expect(findRefStripDropTargetAt(map, "a", 110, 120)).toBe("c");
  });

  it("ignores drag source id", () => {
    const map = new Map<string, HTMLDivElement>([["a", mockThumb("a", 0)]]);
    expect(findRefStripDropTargetAt(map, "a", 20, 120)).toBeNull();
  });
});
