import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { defaultVideoNodePersisted } from "@/lib/videoNodeTypes";
import { videoNodeIdsForBeats } from "@/lib/storyboard/autoComposePreviewAfterBatch";
import { readAutoComposePreviewAfterBatchVideo } from "@/lib/storyboard/scriptProductionPrefs";

describe("videoNodeIdsForBeats", () => {
  it("collects video nodes for beats via script→image→video chain", () => {
    const nodes: Node<FlowNodeData>[] = [
      { id: "script-1", type: "scriptNode", position: { x: 0, y: 0 }, data: {} },
      {
        id: "img-1",
        type: "imageNode",
        position: { x: 0, y: 0 },
        data: { path: "a.png", params: { scriptBeatId: "beat-a" } },
      },
      {
        id: "vid-1",
        type: "videoNode",
        position: { x: 0, y: 0 },
        data: { params: { scriptBeatId: "beat-a" }, video: defaultVideoNodePersisted() },
      },
    ];
    const edges: Edge[] = [
      { id: "e1", source: "script-1", target: "img-1" },
      { id: "e2", source: "img-1", target: "vid-1" },
    ];
    const ids = videoNodeIdsForBeats("script-1", ["beat-a", "beat-b"], nodes, edges);
    expect(ids).toEqual(["vid-1"]);
  });
});

describe("readAutoComposePreviewAfterBatchVideo", () => {
  it("defaults to enabled", () => {
    expect(readAutoComposePreviewAfterBatchVideo()).toBe(true);
  });
});
