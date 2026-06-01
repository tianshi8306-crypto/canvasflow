import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import type { FlowNodeData, ScriptBeat, StoryboardShot } from "@/lib/types";
import { resolveVacantBeatsForSplitShots } from "./splitSpawnedImagesIntoStoryboard";

function n(id: string, type: string, data: Partial<FlowNodeData> = {}): Node<FlowNodeData> {
  return { id, type, position: { x: 0, y: 0 }, data: data as FlowNodeData };
}

const beats: ScriptBeat[] = [
  { id: "b1", shotNumber: "1", description: "a" } as ScriptBeat,
  { id: "b2", shotNumber: "2", description: "b" } as ScriptBeat,
  { id: "b3", shotNumber: "3", description: "c" } as ScriptBeat,
  { id: "b4", shotNumber: "4", description: "d" } as ScriptBeat,
];

describe("resolveVacantBeatsForSplitShots", () => {
  it("picks vacant beats after anchor in scope order", () => {
    const shots: StoryboardShot[] = [
      { scriptBeatId: "b1", visualPrompt: "x", imagePath: "assets/a.png", status: "generated" },
      { scriptBeatId: "b2", visualPrompt: "y", status: "idle" },
      { scriptBeatId: "b3", visualPrompt: "z", imagePath: "assets/c.png", status: "generated" },
      { scriptBeatId: "b4", visualPrompt: "w", status: "idle" },
    ];
    const nodes = [
      n("script", "scriptNode"),
      n("i1", "imageNode", { params: { scriptBeatId: "b1" }, path: "assets/a.png" }),
      n("i3", "imageNode", { params: { scriptBeatId: "b3" }, path: "assets/c.png" }),
    ];
    const edges = [
      { id: "e1", source: "script", target: "i1" },
      { id: "e3", source: "script", target: "i3" },
    ];

    const slots = resolveVacantBeatsForSplitShots({
      scriptNodeId: "script",
      anchorBeatId: "b1",
      slotCount: 3,
      beats,
      shots,
      scriptBeatSelection: undefined,
      nodes,
      edges,
    });

    expect(slots.map((s) => s.beatId)).toEqual(["b2", "b4"]);
  });

  it("respects script beat selection scope", () => {
    const slots = resolveVacantBeatsForSplitShots({
      scriptNodeId: "script",
      anchorBeatId: "b2",
      slotCount: 2,
      beats,
      shots: beats.map((b) => ({ scriptBeatId: b.id, visualPrompt: "v" })),
      scriptBeatSelection: ["b2", "b4"],
      nodes: [n("script", "scriptNode")],
      edges: [],
    });
    expect(slots.map((s) => s.beatId)).toEqual(["b4"]);
  });

  it("returns empty when anchor not in scope", () => {
    expect(
      resolveVacantBeatsForSplitShots({
        scriptNodeId: "script",
        anchorBeatId: "b9",
        slotCount: 2,
        beats,
        shots: [],
        scriptBeatSelection: ["b1"],
        nodes: [],
        edges: [],
      }),
    ).toEqual([]);
  });
});
