import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import {
  applyScriptBeatRemapToScriptNodeData,
  buildScriptBeatIdRemapForPaste,
  findUpstreamScriptNodeIdInSubgraph,
  remapParamsScriptBeatIdForPaste,
} from "@/lib/pasteScriptBeatRemap";

describe("pasteScriptBeatRemap", () => {
  it("buildScriptBeatIdRemapForPaste assigns fresh ids per beat", () => {
    const beats = [
      { id: "b1", shotNumber: "1", scene: "", durationHint: "", description: "a" },
    ] as FlowNodeData["scriptBeats"];
    const m = buildScriptBeatIdRemapForPaste(beats);
    expect(m.size).toBe(1);
    expect(m.get("b1")).toBeDefined();
    expect(m.get("b1")).not.toBe("b1");
  });

  it("applyScriptBeatRemapToScriptNodeData remaps beats, selection and storyboard", () => {
    const beats = [
      { id: "old1", shotId: "old1", shotNumber: "1", scene: "", durationHint: "", description: "x" },
    ] as FlowNodeData["scriptBeats"];
    const m = new Map<string, string>([["old1", "new1"]]);
    const data: FlowNodeData = {
      scriptBeats: beats,
      scriptBeatSelection: ["old1"],
      storyboardShots: [{ scriptBeatId: "old1", visualPrompt: "v" }],
    };
    const next = applyScriptBeatRemapToScriptNodeData(data, m);
    expect(next.scriptBeats?.[0]?.id).toBe("new1");
    expect(next.scriptBeats?.[0]?.shotId).toBe("new1");
    expect(next.scriptBeatSelection).toEqual(["new1"]);
    expect(next.storyboardShots?.[0]?.scriptBeatId).toBe("new1");
  });

  it("findUpstreamScriptNodeIdInSubgraph skips disabled edges", () => {
    const nodes = [
      { id: "S", type: "scriptNode" },
      { id: "I", type: "imageNode" },
    ] as Node<FlowNodeData>[];
    const edges: Edge[] = [
      {
        id: "e1",
        source: "S",
        target: "I",
        data: { disabled: true },
      } as Edge,
    ];
    expect(findUpstreamScriptNodeIdInSubgraph("I", edges, nodes)).toBeNull();
  });

  it("findUpstreamScriptNodeIdInSubgraph finds script over enabled edge", () => {
    const nodes = [
      { id: "S", type: "scriptNode" },
      { id: "I", type: "imageNode" },
    ] as Node<FlowNodeData>[];
    const edges: Edge[] = [
      { id: "e1", source: "S", target: "I", sourceHandle: "out", targetHandle: "in" } as Edge,
    ];
    expect(findUpstreamScriptNodeIdInSubgraph("I", edges, nodes)).toBe("S");
  });

  it("remapParamsScriptBeatIdForPaste maps bound beat id", () => {
    const m = new Map([["bOld", "bNew"]]);
    const data: FlowNodeData = { params: { scriptBeatId: "bOld" } };
    expect(remapParamsScriptBeatIdForPaste(data, m).params).toEqual({ scriptBeatId: "bNew" });
  });
});
