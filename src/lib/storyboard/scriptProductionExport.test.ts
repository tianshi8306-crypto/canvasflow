import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData, ScriptBeat, StoryboardShot } from "@/lib/types";
import { emptyScriptBeat } from "@/lib/scriptBeatHelpers";
import {
  assessBatchVideoReadiness,
  assessComposeExportScope,
  listFailedVideoBeatIds,
} from "./scriptProductionExport";

function n(id: string, type: string, data: Partial<FlowNodeData>): Node<FlowNodeData> {
  return { id, type, position: { x: 0, y: 0 }, data: data as FlowNodeData };
}

const beats: ScriptBeat[] = [
  { ...emptyScriptBeat(), id: "b1", shotNumber: "1" },
  { ...emptyScriptBeat(), id: "b2", shotNumber: "2" },
  { ...emptyScriptBeat(), id: "b3", shotNumber: "3" },
];

describe("scriptProductionExport", () => {
  it("limits batch video to selected beats", () => {
    const scriptId = "s1";
    const nodes: Node<FlowNodeData>[] = [
      n(scriptId, "scriptNode", {}),
      n("i1", "imageNode", {
        path: "assets/a.png",
        params: { scriptBeatId: "b1" },
      }),
      n("v1", "videoNode", {
        params: { scriptBeatId: "b1" },
        video: { draft: { prompt: "move" } },
      }),
    ];
    const edges: Edge[] = [
      { id: "e1", source: scriptId, target: "i1" },
      { id: "e2", source: scriptId, target: "v1" },
    ];
    const shots: StoryboardShot[] = [
      {
        scriptBeatId: "b1",
        visualPrompt: "scene 1",
        status: "generated",
        imagePath: "assets/a.png",
      },
      { scriptBeatId: "b2", visualPrompt: "scene 2", status: "generated" },
      { scriptBeatId: "b3", visualPrompt: "scene 3", status: "generated" },
    ];

    const r = assessBatchVideoReadiness({
      scriptNodeId: scriptId,
      beats,
      shots,
      nodes,
      edges,
      scriptBeatSelection: ["b1", "b2"],
    });
    if (!("canStart" in r)) throw new Error("expected readiness");
    expect(r.scope.mode).toBe("selected");
    expect(r.scope.selectedCount).toBe(2);
    expect(r.eligible).toHaveLength(1);
    expect(r.eligible[0]?.beatId).toBe("b1");
    expect(r.skipCounts.no_video_node).toBe(1);
  });

  it("compose export counts ready videos in scope", () => {
    const scriptId = "s1";
    const nodes: Node<FlowNodeData>[] = [
      n("v1", "videoNode", {
        path: "assets/a.mp4",
        params: { scriptBeatId: "b1" },
      }),
      n("v2", "videoNode", {
        params: { scriptBeatId: "b2" },
      }),
    ];
    const shots: StoryboardShot[] = [
      { scriptBeatId: "b1", visualPrompt: "a" },
      { scriptBeatId: "b2", visualPrompt: "b" },
    ];

    const r = assessComposeExportScope({
      scriptNodeId: scriptId,
      beats: [beats[0]!, beats[1]!],
      shots,
      nodes,
      edges: [],
      scriptBeatSelection: ["b1", "b2"],
    });
    if (!("canExport" in r)) throw new Error("expected compose readiness");
    expect(r.readyCount).toBe(1);
    expect(r.missingCount).toBe(1);
    expect(r.canExport).toBe(true);
  });

  it("listFailedVideoBeatIds returns failed scriptBeatIds", () => {
    const ids = listFailedVideoBeatIds([
      { scriptBeatId: "b1", visualPrompt: "x", videoStatus: "failed" },
      { scriptBeatId: "b2", visualPrompt: "y", videoStatus: "generated" },
    ]);
    expect(ids).toEqual(["b1"]);
  });
});
