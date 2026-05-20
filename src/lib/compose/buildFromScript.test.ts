import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import type { FlowNodeData, ScriptBeat } from "@/lib/types";
import {
  assessScriptComposeReadiness,
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
