import { describe, expect, it } from "vitest";
import type { Node, NodeChange } from "@xyflow/react";
import { snapNodePositionChanges } from "./nodeSnapAlignment";

function n(id: string, x: number, y: number, w = 200, h = 100): Node {
  return {
    id,
    type: "textNode",
    position: { x, y },
    measured: { width: w, height: h },
    data: {},
  };
}

describe("snapNodePositionChanges", () => {
  it("snaps moving node center to target center horizontally", () => {
    const nodes = [n("a", 0, 0, 200, 100), n("b", 2, 40, 200, 100)];
    const changes: NodeChange[] = [
      {
        type: "position",
        id: "b",
        position: { x: 2, y: 40 },
        dragging: true,
      },
    ];
    const { changes: out, visual } = snapNodePositionChanges(changes, nodes);
    const pos = (out[0] as { position: { x: number; y: number } }).position;
    expect(pos.x).toBe(0);
    expect(visual?.guides.some((g) => g.axis === "x")).toBe(true);
  });

  it("snaps moving node left edge to target right edge", () => {
    const nodes = [n("a", 0, 0), n("b", 192, 5)];
    const changes: NodeChange[] = [
      {
        type: "position",
        id: "b",
        position: { x: 195, y: 5 },
        dragging: true,
      },
    ];
    const { changes: out, visual } = snapNodePositionChanges(changes, nodes);
    const pos = (out[0] as { position: { x: number; y: number } }).position;
    expect(pos.x).toBe(200);
    expect(visual?.guides.some((g) => g.axis === "x")).toBe(true);
  });

  it("returns no visual when showGuides is false", () => {
    const nodes = [n("a", 0, 0), n("b", 120, 5)];
    const changes: NodeChange[] = [
      { type: "position", id: "b", position: { x: 108, y: 5 }, dragging: true },
    ];
    const { visual } = snapNodePositionChanges(changes, nodes, { showGuides: false });
    expect(visual).toBeNull();
  });
});
