import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { findImageNodesForScript } from "./batchGenerateImages";

function n(id: string, type: string, data: Partial<FlowNodeData>): Node<FlowNodeData> {
  return { id, type, position: { x: 0, y: 0 }, data: data as FlowNodeData };
}

describe("findImageNodesForScript", () => {
  it("maps scriptBeatId to downstream imageNode id", () => {
    const nodes = [
      n("s1", "scriptNode", {}),
      n("i1", "imageNode", { params: { scriptBeatId: "b1" } }),
      n("i2", "imageNode", { params: { scriptBeatId: "b2" } }),
    ];
    const edges = [
      { source: "s1", target: "i1" },
      { source: "s1", target: "i2" },
    ];
    const map = findImageNodesForScript("s1", nodes, edges);
    expect(map.get("b1")).toBe("i1");
    expect(map.get("b2")).toBe("i2");
  });
});
