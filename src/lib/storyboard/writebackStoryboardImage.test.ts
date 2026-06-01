import { describe, expect, it, vi } from "vitest";
import type { Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { writebackStoryboardShotImagePath } from "./writebackStoryboardImage";

function node(
  id: string,
  type: string,
  data: Partial<FlowNodeData>,
  position = { x: 0, y: 0 },
): Node<FlowNodeData> {
  return { id, type, position, data: data as FlowNodeData };
}

describe("writebackStoryboardShotImagePath", () => {
  it("writes imagePath to matching storyboard shot", () => {
    const updateNodeData = vi.fn();
    const nodes: Node<FlowNodeData>[] = [
      node("script-1", "scriptNode", {
        storyboardShots: [
          { scriptBeatId: "beat-1", visualPrompt: "雨夜街道", status: "idle" },
        ],
        scriptBeats: [{ id: "beat-1", shotNumber: "1", description: "街道" } as FlowNodeData["scriptBeats"] extends (infer B)[] | undefined ? B : never],
      }),
      node("img-1", "imageNode", {
        prompt: "雨夜",
        assetId: "asset-uuid-1",
        params: { scriptBeatId: "beat-1" },
      }),
    ];
    const edges = [{ id: "e1", source: "script-1", target: "img-1" }];

    const ok = writebackStoryboardShotImagePath({
      nodes,
      edges,
      imageNodeId: "img-1",
      imageRelPath: "assets/gen_1.png",
      updateNodeData,
    });

    expect(ok).toBe(true);
    expect(updateNodeData).toHaveBeenCalledWith("script-1", {
      storyboardShots: [
        expect.objectContaining({
          scriptBeatId: "beat-1",
          imagePath: "assets/gen_1.png",
          imageAssetId: "asset-uuid-1",
          status: "generated",
        }),
      ],
    });
  });

  it("returns false when image node has no scriptBeatId", () => {
    const updateNodeData = vi.fn();
    const nodes: Node<FlowNodeData>[] = [
      node("script-1", "scriptNode", { storyboardShots: [] }),
      node("img-1", "imageNode", { params: {} }),
    ];
    const ok = writebackStoryboardShotImagePath({
      nodes,
      edges: [{ id: "e1", source: "script-1", target: "img-1" }],
      imageNodeId: "img-1",
      imageRelPath: "assets/x.png",
      updateNodeData,
    });
    expect(ok).toBe(false);
    expect(updateNodeData).not.toHaveBeenCalled();
  });
});
