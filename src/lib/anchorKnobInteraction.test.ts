import { describe, expect, it } from "vitest";
import {
  clientToKnobPos,
  distanceToRestingKnob,
  getRestingKnobPos,
} from "./anchorKnobInteraction";
import { SIMPLE_ANCHOR_KNOB } from "./simpleAnchorGeometry";

describe("anchorKnobInteraction", () => {
  const zone = { left: 100, top: 50, width: 40, height: 200, right: 140, bottom: 250 } as DOMRect;

  it("resting knob is centered in zone", () => {
    const rest = getRestingKnobPos(zone, "left");
    expect(rest.left).toBe((zone.width - SIMPLE_ANCHOR_KNOB) / 2);
    expect(rest.top).toBe((zone.height - SIMPLE_ANCHOR_KNOB) / 2);
  });

  it("magnet knob center follows pointer within zone", () => {
    const cx = zone.left + zone.width / 2;
    const cy = zone.top + zone.height / 2;
    const pos = clientToKnobPos(zone, cx, cy, 1);
    expect(pos.left).toBeCloseTo((cx - zone.left) / 1, 0);
    expect(pos.top).toBeCloseTo((cy - zone.top) / 1, 0);
  });

  it("distance to resting is zero at default center", () => {
    const rest = getRestingKnobPos(zone, "left");
    const rcx = zone.left + rest.left + SIMPLE_ANCHOR_KNOB / 2;
    const rcy = zone.top + rest.top + SIMPLE_ANCHOR_KNOB / 2;
    expect(distanceToRestingKnob(zone, "left", rcx, rcy)).toBe(0);
  });
});
