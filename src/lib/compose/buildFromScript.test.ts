import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData, ScriptBeat } from "@/lib/types";
import {
  assessScriptComposeReadiness,
  buildComposeClipsFromScript,
  findConcatNodeForScriptVideos,
  mapVideoNodesByScriptBeat,
} from "./buildFromScript";

describe("mapVideoNodesByScriptBeat", () => {
  it("prefers storyboardShots.videoNodeId", () => {
    const nodes: Node<FlowNodeData>[] = [
      { id: "v1", type: "videoNode", position: { x: 0, y: 0 }, data: { path: "a.mp4" } },
    ];
    const map = mapVideoNodesByScriptBeat(
      "s1",
      nodes,
      [],
      [{ scriptBeatId: "b1", visualPrompt: "x", videoNodeId: "v1" }],
    );
    expect(map.get("b1")).toBe("v1");
  });
});

describe("assessScriptComposeReadiness", () => {
  it("counts ready clips with path", () => {
    const beats = [{ id: "b1", shotNumber: "1" } as ScriptBeat];
    const nodes: Node<FlowNodeData>[] = [
      {
        id: "v1",
        type: "videoNode",
        position: { x: 0, y: 0 },
        data: { path: "assets/a.mp4", params: { scriptBeatId: "b1" } },
      },
    ];
    const r = assessScriptComposeReadiness(beats, [], nodes, [], "s1");
    expect(r.readyCount).toBe(1);
    expect(r.missingCount).toBe(0);
  });
});

describe("buildComposeClipsFromScript", () => {
  it("collects clip paths in beat order using video path", async () => {
    const beats = [
      { id: "b1", shotNumber: "1" } as ScriptBeat,
      { id: "b2", shotNumber: "2" } as ScriptBeat,
    ];
    const nodes: Node<FlowNodeData>[] = [
      {
        id: "v1",
        type: "videoNode",
        position: { x: 0, y: 0 },
        data: { path: "assets/a.mp4", params: { scriptBeatId: "b1" } },
      },
      {
        id: "v2",
        type: "videoNode",
        position: { x: 0, y: 0 },
        data: { path: "assets/b.mp4", params: { scriptBeatId: "b2" } },
      },
    ];
    const built = await buildComposeClipsFromScript({
      scriptNodeId: "s1",
      beats,
      shots: [],
      nodes,
      edges: [],
      projectPath: "/proj",
    });
    expect(built.clipPaths).toEqual(["assets/a.mp4", "assets/b.mp4"]);
    expect(built.missing).toHaveLength(0);
    expect(built.clips[0]?.scriptBeatId).toBe("b1");
  });

  it("records missing when video has no path", async () => {
    const beats = [{ id: "b1", shotNumber: "1" } as ScriptBeat];
    const nodes: Node<FlowNodeData>[] = [
      {
        id: "v1",
        type: "videoNode",
        position: { x: 0, y: 0 },
        data: { params: { scriptBeatId: "b1" } },
      },
    ];
    const built = await buildComposeClipsFromScript({
      scriptNodeId: "s1",
      beats,
      shots: [],
      nodes,
      edges: [],
      projectPath: "/proj",
    });
    expect(built.clipPaths).toHaveLength(0);
    expect(built.missing[0]?.reason).toBe("no_media");
  });
});

describe("findConcatNodeForScriptVideos", () => {
  it("returns concat id when a linked video feeds it", () => {
    const nodes: Node<FlowNodeData>[] = [
      { id: "v1", type: "videoNode", position: { x: 0, y: 0 }, data: {} },
      { id: "c1", type: "ffmpegConcat", position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [{ id: "e1", source: "v1", target: "c1" }];
    expect(findConcatNodeForScriptVideos(nodes, edges, ["v1"])).toBe("c1");
  });
});
