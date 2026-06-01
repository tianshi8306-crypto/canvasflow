import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import {
  computeAlignedPositions,
  computeDistributedPositions,
} from "./nodeAlignCommands";

function node(id: string, x: number, y: number, w = 100, h = 80): Node {
  return {
    id,
    type: "textNode",
    position: { x, y },
    measured: { width: w, height: h },
    data: {},
  };
}

describe("nodeAlignCommands", () => {
  it("aligns left edges to selection min left", () => {
    const nodes = [node("a", 10, 0), node("b", 50, 20)];
    const pos = computeAlignedPositions(nodes, "left");
    expect(pos.get("a")?.x).toBe(10);
    expect(pos.get("b")?.x).toBe(10);
  });

  it("aligns horizontal centers", () => {
    const nodes = [node("a", 0, 0, 100, 80), node("b", 200, 0, 100, 80)];
    const pos = computeAlignedPositions(nodes, "centerH");
    const a = pos.get("a")!;
    const b = pos.get("b")!;
    expect(a.x + 50).toBeCloseTo(b.x + 50, 0);
  });

  it("distributes horizontal gaps evenly with fixed ends", () => {
    const nodes = [node("a", 0, 0, 40, 40), node("b", 100, 0, 40, 40), node("c", 300, 0, 40, 40)];
    const pos = computeDistributedPositions(nodes, "horizontal");
    expect(pos.get("a")?.x).toBe(0);
    expect(pos.get("c")?.x).toBe(300);
    const mid = pos.get("b")!.x;
    expect(mid).toBeGreaterThan(40);
    expect(mid).toBeLessThan(220);
  });

  it("requires at least 3 nodes to distribute", () => {
    const nodes = [node("a", 0, 0), node("b", 100, 0)];
    expect(computeDistributedPositions(nodes, "horizontal").size).toBe(0);
  });
});
