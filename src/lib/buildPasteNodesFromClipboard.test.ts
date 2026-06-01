import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData, ScriptBeat } from "@/lib/types";
import { buildPasteEdgesFromClipboard, buildPasteNodesFromClipboard } from "@/lib/buildPasteNodesFromClipboard";

function scriptNode(id: string, beats: ScriptBeat[]): Node<FlowNodeData> {
  return {
    id,
    type: "scriptNode",
    position: { x: 0, y: 0 },
    data: { scriptBeats: beats, scriptBeatSelection: [beats[0]!.id] },
  } as Node<FlowNodeData>;
}

function imageNode(id: string, scriptBeatId: string): Node<FlowNodeData> {
  return {
    id,
    type: "imageNode",
    position: { x: 100, y: 0 },
    data: { params: { scriptBeatId } },
  } as Node<FlowNodeData>;
}

describe("buildPasteNodesFromClipboard", () => {
  it("remaps script beats and downstream params.scriptBeatId when subgraph is pasted", () => {
    const b0: ScriptBeat = {
      id: "beat-old",
      shotNumber: "1",
      scene: "",
      durationHint: "",
      description: "d",
      character1: "",
      character1Desc: "",
      character1Image: "",
      character2: "",
      character2Desc: "",
      character2Image: "",
      reference: "",
      shotSize: "",
      characterAction: "",
      emotion: "",
      sceneTags: "",
      lightingMood: "",
      soundEffect: "",
      dialogue: "",
      storyboardPrompt: "",
      videoMotionPrompt: "",
    };
    const S = scriptNode("S-old", [b0]);
    const I = imageNode("I-old", "beat-old");
    const copiedNodes = [S, I];
    const copiedEdges: Edge[] = [
      {
        id: "e0",
        source: "S-old",
        target: "I-old",
        sourceHandle: "out",
        targetHandle: "in",
      } as Edge,
    ];
    const { nextNodes, idMap } = buildPasteNodesFromClipboard({ copiedNodes, copiedEdges });
    expect(idMap.size).toBe(2);
    const nextS = nextNodes.find((n) => n.type === "scriptNode");
    const nextI = nextNodes.find((n) => n.type === "imageNode");
    expect(nextS?.data.scriptBeats?.[0]?.id).not.toBe("beat-old");
    expect(nextI?.data.params && (nextI.data.params as { scriptBeatId?: string }).scriptBeatId).toBe(
      nextS?.data.scriptBeats?.[0]?.id,
    );
    const nextEdges = buildPasteEdgesFromClipboard(copiedEdges, idMap, nextNodes);
    expect(nextEdges).toHaveLength(1);
    expect(nextEdges[0]!.source).toBe(nextS!.id);
    expect(nextEdges[0]!.target).toBe(nextI!.id);
  });

  it("applies offset only to paste subtree roots (nested group child keeps relative position)", () => {
    const G = {
      id: "g1",
      type: "group",
      position: { x: 100, y: 100 },
      data: { label: "组" },
      style: { width: 400, height: 300 },
    } as Node<FlowNodeData>;
    const A = {
      id: "a1",
      type: "imageNode",
      parentId: "g1",
      position: { x: 40, y: 50 },
      data: {},
    } as Node<FlowNodeData>;
    const { nextNodes } = buildPasteNodesFromClipboard(
      { copiedNodes: [G, A], copiedEdges: [] },
      48,
    );
    const nextG = nextNodes.find((n) => n.type === "group");
    const nextA = nextNodes.find((n) => n.type === "imageNode");
    expect(nextG?.position).toEqual({ x: 148, y: 148 });
    expect(nextA?.position).toEqual({ x: 40, y: 50 });
  });
});
