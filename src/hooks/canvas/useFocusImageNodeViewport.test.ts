import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import { getImageNodeFlowCenter } from "./useFocusImageNodeViewport";

describe("getImageNodeFlowCenter", () => {
  it("uses measured dimensions when available", () => {
    const node: Node = {
      id: "n1",
      type: "imageNode",
      position: { x: 100, y: 50 },
      measured: { width: 400, height: 225 },
      data: {},
    };
    const c = getImageNodeFlowCenter(node);
    expect(c.x).toBe(300);
    expect(c.y).toBe(162.5);
  });

  it("falls back to aspect frame for imageNode without measure", () => {
    const node: Node = {
      id: "n1",
      type: "imageNode",
      position: { x: 0, y: 0 },
      data: { params: { imageOutput: { aspect: "16:9" } } },
    };
    const c = getImageNodeFlowCenter(node);
    expect(c.x).toBe(250);
    expect(c.y).toBe(140.5);
  });
});
