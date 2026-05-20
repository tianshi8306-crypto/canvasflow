import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import {
  getSimpleAnchorCenterOffsetX,
  getSimpleAnchorFlowPosition,
  getSimpleAnchorRestingKnobPos,
  SIMPLE_ANCHOR_EDGE_GAP,
  SIMPLE_ANCHOR_KNOB,
} from "./simpleAnchorGeometry";

function imageNode(x: number, y: number, w = 400, h = 225): Node {
  return {
    id: "n1",
    type: "imageNode",
    position: { x, y },
    measured: { width: w, height: h },
    data: {},
  };
}

describe("simpleAnchorGeometry", () => {
  it("symmetric gap on left and right", () => {
    const w = 400;
    const outward = SIMPLE_ANCHOR_EDGE_GAP + SIMPLE_ANCHOR_KNOB / 2; // 12 + 9 = 21
    expect(getSimpleAnchorCenterOffsetX("left", w)).toBe(-outward);
    expect(getSimpleAnchorCenterOffsetX("right", w)).toBe(w + outward);
  });

  it("resting knob wrap mirrors left/right (center offset gap+r from zone inner edge)", () => {
    const zoneW = 48;
    const zoneH = 200;
    const r = SIMPLE_ANCHOR_KNOB / 2;
    const left = getSimpleAnchorRestingKnobPos(zoneW, zoneH, "left");
    const right = getSimpleAnchorRestingKnobPos(zoneW, zoneH, "right");
    expect(left.left).toBe(zoneW - SIMPLE_ANCHOR_KNOB);
    expect(right.left).toBe(0);
    const leftCenterX = left.left + r;
    const rightCenterX = right.left + r;
    expect(leftCenterX).toBe(zoneW - r);
    expect(rightCenterX).toBe(r);
    expect(zoneW - leftCenterX).toBe(rightCenterX);
  });

  it("flow positions match symmetric offsets", () => {
    const n = imageNode(100, 50);
    const inward = getSimpleAnchorFlowPosition(n, "target");
    const outward = getSimpleAnchorFlowPosition(n, "source");
    expect(inward.x).toBe(100 - (SIMPLE_ANCHOR_EDGE_GAP + SIMPLE_ANCHOR_KNOB / 2));
    expect(outward.x).toBe(100 + 400 + SIMPLE_ANCHOR_EDGE_GAP + SIMPLE_ANCHOR_KNOB / 2);
    expect(inward.y).toBe(outward.y);
  });
});
