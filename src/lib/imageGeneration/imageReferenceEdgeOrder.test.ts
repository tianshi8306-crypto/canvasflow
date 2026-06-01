import { describe, expect, it } from "vitest";
import type { IncomingImageRef } from "@/lib/imageGeneration/types";
import {
  applyImageRefEdgeOrder,
  reorderImageRefEdgeOrder,
  syncImageReferenceEdgeOrder,
} from "@/lib/imageGeneration/imageReferenceEdgeOrder";

function ref(edgeId: string, y: number): IncomingImageRef {
  return { kind: "image", edgeId, sourceNodeId: `n-${edgeId}`, y, nodeLabel: "图片" };
}

describe("imageReferenceEdgeOrder", () => {
  it("applyImageRefEdgeOrder respects saved order", () => {
    const items = [ref("e1", 0), ref("e2", 10), ref("e3", 20)];
    const ordered = applyImageRefEdgeOrder(items, ["e3", "e1"]);
    expect(ordered.map((i) => i.edgeId)).toEqual(["e3", "e1", "e2"]);
  });

  it("syncImageReferenceEdgeOrder merges new edges", () => {
    const items = [ref("e1", 0), ref("e2", 10)];
    expect(syncImageReferenceEdgeOrder(["e2"], items)).toEqual(["e2", "e1"]);
  });

  it("reorderImageRefEdgeOrder swaps strip positions", () => {
    const items = [ref("e1", 0), ref("e2", 10), ref("e3", 20)];
    const order = reorderImageRefEdgeOrder(
      items,
      ["e1", "e2", "e3"],
      ["e1", "e2", "e3"],
      "e1",
      "e2",
    );
    expect(order).toEqual(["e2", "e1", "e3"]);
  });
});
