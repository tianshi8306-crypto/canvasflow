import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { findImageNodesForScript, findVideoNodesForScript } from "./storyboardMediaNodes";

function n(id: string, type: string, data: Partial<FlowNodeData> = {}): Node<FlowNodeData> {
  return { id, type, position: { x: 0, y: 0 }, data: data as FlowNodeData };
}

describe("findVideoNodesForScript", () => {
  it("resolves video via script→image→video chain", () => {
    const nodes = [
      n("s", "scriptNode"),
      n("i", "imageNode", { params: { scriptBeatId: "b1" } }),
      n("v", "videoNode", { params: { scriptBeatId: "b1" } }),
    ];
    const edges = [
      { source: "s", target: "i" },
      { source: "i", target: "v" },
    ];
    const map = findVideoNodesForScript("s", nodes, edges);
    expect(map.get("b1")).toBe("v");
  });

  it("prefers direct script→video when present", () => {
    const nodes = [
      n("s", "scriptNode"),
      n("v1", "videoNode", { params: { scriptBeatId: "b1" } }),
      n("i", "imageNode", { params: { scriptBeatId: "b1" } }),
      n("v2", "videoNode", { params: { scriptBeatId: "b1" } }),
    ];
    const edges = [
      { source: "s", target: "v1" },
      { source: "s", target: "i" },
      { source: "i", target: "v2" },
    ];
    expect(findVideoNodesForScript("s", nodes, edges).get("b1")).toBe("v1");
  });
});

describe("findImageNodesForScript", () => {
  it("maps beat to direct image child", () => {
    const nodes = [
      n("s", "scriptNode"),
      n("i", "imageNode", { params: { scriptBeatId: "b1" } }),
    ];
    const edges = [{ source: "s", target: "i" }];
    expect(findImageNodesForScript("s", nodes, edges).get("b1")).toBe("i");
  });
});
