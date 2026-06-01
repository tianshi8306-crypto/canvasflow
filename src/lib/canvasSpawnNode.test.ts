import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import {
  flowTopLeftFromCenter,
  paneCenterFlowPosition,
  resolveNonOverlappingTopLeft,
} from "@/lib/canvasSpawnNode";

describe("paneCenterFlowPosition", () => {
  it("uses pane client rect center, not window size", () => {
    const screenToFlow = (p: { x: number; y: number }) => ({
      x: p.x - 200,
      y: p.y - 80,
    });
    const pane = { left: 200, top: 80, width: 1000, height: 800 };
    const center = paneCenterFlowPosition(screenToFlow, pane, 0.5);
    expect(center).toEqual({ x: 500, y: 400 });
  });
});

describe("flowTopLeftFromCenter", () => {
  it("offsets by half node size", () => {
    expect(flowTopLeftFromCenter({ x: 100, y: 100 }, { w: 280, h: 200 })).toEqual({
      x: -40,
      y: 0,
    });
  });
});

describe("resolveNonOverlappingTopLeft", () => {
  it("shifts when overlapping existing node", () => {
    const existing: Node<FlowNodeData>[] = [
      {
        id: "a",
        type: "textNode",
        position: { x: 0, y: 0 },
        data: { label: "t" },
      },
    ];
    const pos = resolveNonOverlappingTopLeft({ x: 0, y: 0 }, { w: 280, h: 200 }, existing);
    expect(pos.x).toBeGreaterThan(0);
    expect(pos.y).toBe(0);
  });
});
