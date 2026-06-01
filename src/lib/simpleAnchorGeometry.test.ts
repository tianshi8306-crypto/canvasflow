import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import {
  getSimpleAnchorCenterOffsetX,
  getSimpleAnchorFlowPosition,
  getSimpleAnchorRestingKnobPos,
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
  it("connection anchors sit on left/right border", () => {
    const w = 400;
    expect(getSimpleAnchorCenterOffsetX("left", w)).toBe(0);
    expect(getSimpleAnchorCenterOffsetX("right", w)).toBe(w);
  });

  it("resting knob is centered in outer hit zone", () => {
    const zoneW = 48;
    const zoneH = 200;
    const r = SIMPLE_ANCHOR_KNOB / 2;
    const left = getSimpleAnchorRestingKnobPos(zoneW, zoneH, "left");
    const right = getSimpleAnchorRestingKnobPos(zoneW, zoneH, "right");
    expect(left.left).toBe((zoneW - SIMPLE_ANCHOR_KNOB) / 2);
    expect(right.left).toBe((zoneW - SIMPLE_ANCHOR_KNOB) / 2);
    expect(left.top).toBe((zoneH - SIMPLE_ANCHOR_KNOB) / 2);
    expect(left.left + r).toBe(zoneW / 2);
  });

  it("flow positions use border x", () => {
    const n = imageNode(100, 50);
    const inward = getSimpleAnchorFlowPosition(n, "target");
    const outward = getSimpleAnchorFlowPosition(n, "source");
    expect(inward.x).toBe(100);
    expect(outward.x).toBe(100 + 400);
    expect(inward.y).toBe(outward.y);
  });
});
