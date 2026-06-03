import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import type { FlowNodeData, ScriptBeat, StoryboardShot } from "@/lib/types";
import { emptyScriptBeat } from "@/lib/scriptBeatHelpers";
import { planHermesBatchImageJobs } from "./hermesBatchSplitStrategy";

function n(id: string, type: string, data: Partial<FlowNodeData> = {}): Node<FlowNodeData> {
  return { id, type, position: { x: 0, y: 0 }, data: data as FlowNodeData };
}

const beats: ScriptBeat[] = [
  { ...emptyScriptBeat(), id: "b1", shotNumber: "1" },
  { ...emptyScriptBeat(), id: "b2", shotNumber: "2" },
  { ...emptyScriptBeat(), id: "b3", shotNumber: "3" },
  { ...emptyScriptBeat(), id: "b4", shotNumber: "4" },
  { ...emptyScriptBeat(), id: "b5", shotNumber: "5" },
];

describe("planHermesBatchImageJobs", () => {
  const nodes = [
    n("script", "scriptNode"),
    n("i1", "imageNode", { params: { scriptBeatId: "b1" } }),
    n("i2", "imageNode", { params: { scriptBeatId: "b2" } }),
    n("i3", "imageNode", { params: { scriptBeatId: "b3" } }),
    n("i4", "imageNode", { params: { scriptBeatId: "b4" } }),
    n("i5", "imageNode", { params: { scriptBeatId: "b5" } }),
  ];
  const edges = beats.map((_, i) => ({
    id: `e${i}`,
    source: "script",
    target: `i${i + 1}`,
  }));
  const shots: StoryboardShot[] = beats.map((b) => ({
    scriptBeatId: b.id,
    visualPrompt: "scene",
    status: "generated" as const,
  }));

  it("pack_forward packs first anchor and skips filled forward beats", () => {
    const jobs = planHermesBatchImageJobs({
      strategy: "pack_forward",
      packImageCount: 4,
      scriptNodeId: "script",
      beatIds: undefined,
      beats,
      shots,
      nodes,
      edges,
    });
    expect(jobs).toEqual([
      { beatId: "b1", imageNodeId: "i1", imageCount: 4 },
      { beatId: "b5", imageNodeId: "i5", imageCount: 1 },
    ]);
  });

  it("per_beat emits one job per vacant beat with node imageCount", () => {
    const nodesWithCount = nodes.map((node) =>
      node.id === "i1"
        ? { ...node, data: { ...node.data, params: { scriptBeatId: "b1", imageCount: 3 } } }
        : node,
    );
    const jobs = planHermesBatchImageJobs({
      strategy: "per_beat",
      packImageCount: 4,
      scriptNodeId: "script",
      beatIds: ["b1", "b2"],
      beats,
      shots,
      nodes: nodesWithCount,
      edges,
    });
    expect(jobs).toEqual([
      { beatId: "b1", imageNodeId: "i1", imageCount: 2 },
      { beatId: "b2", imageNodeId: "i2", imageCount: 1 },
    ]);
  });
});
