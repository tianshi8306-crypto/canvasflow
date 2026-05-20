import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { countIncomingScriptUpstreams, validateConnection } from "@/lib/flowConnectionPolicy";

function node(id: string, type: Node<FlowNodeData>["type"]): Node<FlowNodeData> {
  return { id, type, position: { x: 0, y: 0 }, data: {} } as Node<FlowNodeData>;
}

function edge(source: string, target: string): Edge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    sourceHandle: "out",
    targetHandle: "in",
  };
}

describe("flowConnectionPolicy script upstream", () => {
  it("countIncomingScriptUpstreams dedupes by source", () => {
    const nodes = [node("S1", "scriptNode"), node("I", "imageNode")];
    const edges = [edge("S1", "I"), edge("S1", "I")];
    expect(countIncomingScriptUpstreams(nodes, edges, "I")).toBe(1);
  });

  it("rejects second scriptNode to imageNode", () => {
    const nodes = [node("S1", "scriptNode"), node("S2", "scriptNode"), node("I", "imageNode")];
    const edges = [edge("S1", "I")];
    const verdict = validateConnection(
      { source: "S2", target: "I", sourceHandle: "out", targetHandle: "in" },
      nodes,
      edges,
    );
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toContain("脚本");
    }
  });

  it("allows first scriptNode to videoNode", () => {
    const nodes = [node("S", "scriptNode"), node("V", "videoNode")];
    const verdict = validateConnection(
      { source: "S", target: "V", sourceHandle: "out", targetHandle: "in" },
      nodes,
      [],
    );
    expect(verdict.ok).toBe(true);
  });
});
