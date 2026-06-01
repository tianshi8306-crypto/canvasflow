import { describe, expect, it } from "vitest";
import {
  applyGridSnapToPositionChanges,
  snapPointToGrid,
  snapScalarToGrid,
} from "@/lib/nodeGridSnap";

describe("snapScalarToGrid", () => {
  it("rounds to nearest step", () => {
    expect(snapScalarToGrid(43, 40)).toBe(40);
    expect(snapScalarToGrid(61, 40)).toBe(80);
  });
});

describe("snapPointToGrid", () => {
  it("snaps both axes", () => {
    expect(snapPointToGrid({ x: 43, y: 57 }, 40)).toEqual({ x: 40, y: 40 });
  });
});

describe("applyGridSnapToPositionChanges", () => {
  it("only snaps position changes with dragging false", () => {
    const changes = applyGridSnapToPositionChanges(
      [
        { type: "position", id: "a", position: { x: 43, y: 57 }, dragging: true },
        { type: "position", id: "b", position: { x: 43, y: 57 }, dragging: false },
      ],
      40,
    );
    expect(changes[0]).toMatchObject({ position: { x: 43, y: 57 } });
    expect(changes[1]).toMatchObject({ position: { x: 40, y: 40 } });
  });
});
