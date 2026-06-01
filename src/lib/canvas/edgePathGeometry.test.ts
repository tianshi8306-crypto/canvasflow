import { describe, expect, it } from "vitest";
import {
  closestPointOnEdgePath,
  pointOnEdgePathAtRatio,
} from "./edgePathGeometry";

describe("edgePathGeometry", () => {
  it("projects pointer onto a straight segment", () => {
    const path = "M 0 0 L 100 0";
    const hit = closestPointOnEdgePath(path, 50, 40);
    expect(hit.x).toBeCloseTo(50, 0);
    expect(hit.y).toBeCloseTo(0, 0);
    expect(hit.distance).toBeCloseTo(40, 0);
  });

  it("clamps to endpoints when pointer is beyond segment", () => {
    const path = "M 0 0 L 100 0";
    const hit = closestPointOnEdgePath(path, 150, 0);
    expect(hit.x).toBeCloseTo(100, 0);
    expect(hit.distance).toBeCloseTo(50, 0);
  });

  it("returns pathT along a straight segment for pointer projection", () => {
    const hit = closestPointOnEdgePath("M 0 0 L 100 0", 25, 0);
    expect(hit.pathT).toBeCloseTo(0.25, 2);
    expect(hit.x).toBeCloseTo(25, 0);
  });

  it("pointOnEdgePathAtRatio matches pathT on a straight segment", () => {
    const pt = pointOnEdgePathAtRatio("M 0 0 L 100 0", 0.25);
    expect(pt).not.toBeNull();
    expect(pt!.x).toBeCloseTo(25, 0);
    expect(pt!.y).toBeCloseTo(0, 0);
  });
});
