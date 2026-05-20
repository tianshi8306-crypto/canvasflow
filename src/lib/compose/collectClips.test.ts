import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import type { FlowNodeData, ScriptBeat } from "@/lib/types";
import { beatSortIndex, sortClipsByScriptBeats, type ComposeClip } from "./collectClips";

function scriptNode(id: string, beats: ScriptBeat[]): Node<FlowNodeData> {
  return { id, type: "scriptNode", position: { x: 0, y: 0 }, data: { scriptBeats: beats } };
}

function videoNode(id: string, beatId: string): Node<FlowNodeData> {
  return {
    id,
    type: "videoNode",
    position: { x: 0, y: 0 },
    data: { params: { scriptBeatId: beatId }, path: `assets/${id}.mp4` },
  };
}

describe("sortClipsByScriptBeats", () => {
  it("orders clips by scriptBeats array index", () => {
    const nodes = [
      scriptNode("s1", [
        { id: "b2", shotNumber: "2" } as ScriptBeat,
        { id: "b1", shotNumber: "1" } as ScriptBeat,
      ]),
      videoNode("v2", "b2"),
      videoNode("v1", "b1"),
    ];
    const clips: ComposeClip[] = [
      { sourceNodeId: "v2", relPath: "a.mp4", scriptBeatId: "b2" },
      { sourceNodeId: "v1", relPath: "b.mp4", scriptBeatId: "b1" },
    ];
    const sorted = sortClipsByScriptBeats(clips, nodes);
    expect(sorted.map((c) => c.sourceNodeId)).toEqual(["v2", "v1"]);
  });

  it("uses storyboardShots.videoNodeId when params lack beatId", () => {
    const nodes: Node<FlowNodeData>[] = [
      {
        id: "s1",
        type: "scriptNode",
        position: { x: 0, y: 0 },
        data: {
          scriptBeats: [{ id: "b1", shotNumber: "1" } as ScriptBeat],
          storyboardShots: [{ scriptBeatId: "b1", visualPrompt: "x", videoNodeId: "v1" }],
        },
      },
      { id: "v1", type: "videoNode", position: { x: 0, y: 0 }, data: { path: "a.mp4" } },
    ];
    expect(beatSortIndex(nodes, "v1")).toBe(0);
  });
});
