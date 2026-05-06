import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { parseCanvas, serializeCanvas } from "@/lib/serialization";

describe("serialization roundtrip", () => {
  it("preserves script beats and bound scriptBeatId after serialize/parse", () => {
    const beatId = "beat-x-1";
    const nodes: Node<FlowNodeData>[] = [
      {
        id: "S1",
        type: "scriptNode",
        position: { x: 0, y: 0 },
        data: {
          label: "脚本",
          scriptBeats: [
            {
              id: beatId,
              shotId: beatId,
              shotNumber: "01",
              scene: "",
              durationHint: "3s",
              description: "镜头",
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
            },
          ],
          scriptBeatSelection: [beatId],
          storyboardShots: [{ scriptBeatId: beatId, visualPrompt: "v" }],
        },
      } as Node<FlowNodeData>,
      {
        id: "I1",
        type: "imageNode",
        position: { x: 400, y: 0 },
        data: { params: { scriptBeatId: beatId } },
      } as Node<FlowNodeData>,
    ];
    const edges: Edge[] = [
      {
        id: "e1",
        source: "S1",
        target: "I1",
        sourceHandle: "out",
        targetHandle: "in",
        data: { payloadType: "script" },
      } as Edge,
    ];
    const viewport = { x: 1, y: 2, zoom: 1.2 };

    const raw = serializeCanvas(nodes, edges, viewport);
    const parsed = parseCanvas(raw);
    const scriptNode = parsed.nodes.find((n) => n.id === "S1")!;
    const imageNode = parsed.nodes.find((n) => n.id === "I1")!;

    expect(parsed.invalidEdgesDropped).toBe(0);
    expect(scriptNode.data.scriptBeats?.[0]?.id).toBe(beatId);
    expect(scriptNode.data.scriptBeatSelection).toEqual([beatId]);
    expect(scriptNode.data.storyboardShots?.[0]?.scriptBeatId).toBe(beatId);
    expect((imageNode.data.params as { scriptBeatId?: string }).scriptBeatId).toBe(beatId);
  });
});
