import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { mergeIncomingSourceIntoComposeTimeline } from "./syncIncomingComposeClip";

function videoNode(id: string, path: string): Node<FlowNodeData> {
  return {
    id,
    type: "videoNode",
    position: { x: 0, y: 0 },
    data: { path, label: id },
  };
}

function concatNode(id: string, clips: FlowNodeData["timelineClips"] = []): Node<FlowNodeData> {
  return {
    id,
    type: "ffmpegConcat",
    position: { x: 100, y: 0 },
    data: { timelineClips: clips },
  };
}

describe("mergeIncomingSourceIntoComposeTimeline", () => {
  it("appends clip when video node connects to empty concat", async () => {
    const nodes = [videoNode("v1", "assets/a.mp4"), concatNode("c1")];
    const edges: Edge[] = [{ id: "e1", source: "v1", target: "c1" }];
    const result = await mergeIncomingSourceIntoComposeTimeline(
      "c1",
      "v1",
      nodes,
      edges,
      "/tmp/proj",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.added).toBe(true);
    expect(result.clips).toHaveLength(1);
    expect(result.clips[0]?.relPath).toBe("assets/a.mp4");
    expect(result.clips[0]?.sourceNodeId).toBe("v1");
  });

  it("updates relPath when same source reconnects with new output", async () => {
    const nodes = [
      videoNode("v1", "assets/b.mp4"),
      concatNode("c1", [
        {
          id: "tcl-1",
          relPath: "assets/a.mp4",
          inSec: 0,
          outSec: null,
          sourceNodeId: "v1",
        },
      ]),
    ];
    const edges: Edge[] = [{ id: "e1", source: "v1", target: "c1" }];
    const result = await mergeIncomingSourceIntoComposeTimeline(
      "c1",
      "v1",
      nodes,
      edges,
      "/tmp/proj",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.updated).toBe(true);
    expect(result.clips[0]?.relPath).toBe("assets/b.mp4");
  });

  it("returns no_media when upstream video has no path", async () => {
    const nodes = [
      { id: "v1", type: "videoNode", position: { x: 0, y: 0 }, data: {} },
      concatNode("c1"),
    ] as Node<FlowNodeData>[];
    const edges: Edge[] = [{ id: "e1", source: "v1", target: "c1" }];
    const result = await mergeIncomingSourceIntoComposeTimeline(
      "c1",
      "v1",
      nodes,
      edges,
      "/tmp/proj",
    );
    expect(result).toEqual({ ok: false, reason: "no_media" });
  });
});
