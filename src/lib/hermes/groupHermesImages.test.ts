import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { emptyScriptBeat } from "@/lib/scriptBeatHelpers";
import {
  evaluateGroupHermesImages,
  resolveGroupHermesBeatIds,
} from "@/lib/hermes/groupHermesImages";

function node(
  id: string,
  type: string,
  data: Partial<FlowNodeData> = {},
  parentId?: string,
): Node<FlowNodeData> {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    parentId,
    data: { label: id, ...data },
  };
}

describe("groupHermesImages", () => {
  const script = node("s1", "scriptNode", {
    scriptBeats: [
      { ...emptyScriptBeat(), id: "b1" },
      { ...emptyScriptBeat(), id: "b2" },
    ],
    scriptBeatSelection: ["b1"],
    storyboardShots: [
      { scriptBeatId: "b1", status: "generated", visualPrompt: "a" },
      { scriptBeatId: "b2", status: "generated", visualPrompt: "b" },
      { scriptBeatId: "b3", status: "idle", visualPrompt: "" },
    ],
  });
  const group = node("g1", "group", {
    groupKind: "storyboard",
    groupScriptNodeId: "s1",
    groupScriptBeatIds: ["b1", "b2"],
  });
  const img = node("i1", "imageNode", { params: { scriptBeatId: "b1" } }, "g1");

  it("evaluateGroupHermesImages ok for storyboard group", () => {
    const v = evaluateGroupHermesImages([script, group, img], [{ id: "e1", source: "s1", target: "i1" }], "g1");
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.scriptNodeId).toBe("s1");
      expect(v.beatIds).toEqual(["b1", "b2"]);
    }
  });

  it("resolveGroupHermesBeatIds respects groupScriptBeatIds", () => {
    const ready = script.data.storyboardShots!.filter((s) => s.status === "generated");
    const ids = resolveGroupHermesBeatIds(group, script, [script, group, img], "g1", ready);
    expect(ids).toEqual(["b1", "b2"]);
  });

  it("evaluate fails without script link", () => {
    const lone = node("g2", "group");
    const v = evaluateGroupHermesImages([lone], [], "g2");
    expect(v.ok).toBe(false);
  });
});
