import { describe, it, expect } from "vitest";
import {
  collectNonTextTokenRanges,
  getAtomicTokenDeletionFromSegments,
  mapCursorAfterSegmentListReplace,
} from "./mentionInputEditing";

describe("mentionInputEditing", () => {
  const segs = [
    { kind: "text" as const, text: "Hello " },
    { kind: "mention" as const, token: "@[n1]" },
    { kind: "text" as const, text: " world" },
  ];

  it("collects non-text ranges", () => {
    expect(collectNonTextTokenRanges(segs)).toEqual([{ start: 6, end: 11 }]);
  });

  it("Backspace removes whole mention token", () => {
    expect(getAtomicTokenDeletionFromSegments(segs, 10, 10, "Backspace")).toEqual({
      start: 6,
      end: 11,
    });
  });

  it("Delete at token start removes whole mention token", () => {
    expect(getAtomicTokenDeletionFromSegments(segs, 6, 6, "Delete")).toEqual({
      start: 6,
      end: 11,
    });
  });

  it("maps cursor when token length changes", () => {
    const oldSegs = [
      { kind: "text" as const, text: "x " },
      { kind: "mention" as const, token: "@[a]" },
      { kind: "text" as const, text: " y" },
    ];
    const newSegs = [
      { kind: "text" as const, text: "x " },
      { kind: "mention" as const, token: "@[long-id]" },
      { kind: "text" as const, text: " y" },
    ];
    const mapped = mapCursorAfterSegmentListReplace(oldSegs, newSegs, 5, 16);
    expect(mapped).toBe(5);
  });
});
