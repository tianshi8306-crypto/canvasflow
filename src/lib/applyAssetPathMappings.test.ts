import { describe, expect, it } from "vitest";
import { applyAssetPathMappingsToNodes } from "./applyAssetPathMappings";
import type { FlowNodeData } from "@/lib/types";

describe("applyAssetPathMappingsToNodes", () => {
  it("replaces exact path strings in node data", () => {
    const nodes = [
      {
        id: "v1",
        type: "videoNode",
        position: { x: 0, y: 0 },
        data: { path: "assets/old.mp4", label: "视频" } satisfies FlowNodeData,
      },
    ];
    const next = applyAssetPathMappingsToNodes(nodes, {
      "assets/old.mp4": "assets/gen/video/seedance/new.mp4",
    });
    expect(next[0]?.data.path).toBe("assets/gen/video/seedance/new.mp4");
  });
});
