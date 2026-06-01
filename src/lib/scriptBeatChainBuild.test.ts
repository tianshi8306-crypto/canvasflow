import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData, ScriptBeat } from "@/lib/types";
import { buildScriptBeatChain, findDownstreamByBeat } from "@/lib/scriptBeatChainBuild";
import { emptyScriptBeat } from "@/lib/scriptBeatHelpers";

function n(id: string, type: string, data: Partial<FlowNodeData>, pos = { x: 0, y: 0 }): Node<FlowNodeData> {
  return { id, type, position: pos, data: data as FlowNodeData };
}

describe("scriptBeatChainBuild", () => {
  const beats: ScriptBeat[] = [
    { ...emptyScriptBeat(), id: "b1", shotNumber: "1" },
    { ...emptyScriptBeat(), id: "b2", shotNumber: "2" },
    { ...emptyScriptBeat(), id: "b3", shotNumber: "3" },
  ];

  it("creates nodes only for selected beats", () => {
    const anchor = n("s1", "scriptNode", {}, { x: 100, y: 200 });
    const result = buildScriptBeatChain({
      scriptNodeId: "s1",
      anchor,
      beats,
      scriptBeatSelection: ["b1", "b2"],
      nodes: [anchor],
      edges: [],
      kinds: ["image", "video"],
    });
    if ("message" in result) throw new Error(result.message);
    expect(result.newNodes).toHaveLength(4);
    expect(result.scope.mode).toBe("selected");
    expect(result.scope.selectedCount).toBe(2);
    const beatIds = result.newNodes.map((node) =>
      (node.data.params as { scriptBeatId?: string })?.scriptBeatId,
    );
    expect(beatIds.every((id) => id === "b1" || id === "b2")).toBe(true);
    expect(beatIds).not.toContain("b3");
  });

  it("skips beats that already have image node", () => {
    const anchor = n("s1", "scriptNode", {});
    const nodes = [
      anchor,
      n("i1", "imageNode", { params: { scriptBeatId: "b1" } }),
    ];
    const edges: Edge[] = [{ id: "e1", source: "s1", target: "i1" }];
    const result = buildScriptBeatChain({
      scriptNodeId: "s1",
      anchor,
      beats: [beats[0]!],
      scriptBeatSelection: ["b1"],
      nodes,
      edges,
      kinds: ["image"],
    });
    if ("message" in result) throw new Error(result.message);
    expect(result.created.image).toBe(0);
    expect(result.skipped.image).toBe(1);
  });

  it("findDownstreamByBeat maps linked nodes", () => {
    const nodes = [
      n("s1", "scriptNode", {}),
      n("i1", "imageNode", { params: { scriptBeatId: "b1" } }),
      n("v1", "videoNode", { params: { scriptBeatId: "b1" } }),
    ];
    const edges = [
      { id: "e1", source: "s1", target: "i1" },
      { id: "e2", source: "s1", target: "v1" },
    ];
    const map = findDownstreamByBeat("s1", nodes, edges);
    expect(map.get("b1")?.imageNodeId).toBe("i1");
    expect(map.get("b1")?.videoNodeId).toBe("v1");
  });

  it("does not treat disabled script→image as existing downstream", () => {
    const anchor = n("s1", "scriptNode", {});
    const nodes = [
      anchor,
      n("i1", "imageNode", { params: { scriptBeatId: "b1" } }),
    ];
    const edges: Edge[] = [
      { id: "e1", source: "s1", target: "i1", data: { disabled: true } },
    ];
    expect(findDownstreamByBeat("s1", nodes, edges).get("b1")?.imageNodeId).toBeUndefined();

    const result = buildScriptBeatChain({
      scriptNodeId: "s1",
      anchor,
      beats: [beats[0]!],
      scriptBeatSelection: ["b1"],
      nodes,
      edges,
      kinds: ["image"],
    });
    if ("message" in result) throw new Error(result.message);
    expect(result.skipped.image).toBe(0);
    expect(result.created.image).toBe(1);
  });
});
