import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { buildEdgeView, buildNodesView, summarizeEdgePayloadText } from "@/hooks/useEdgeViewModel";

function node(id: string, type: Node<FlowNodeData>["type"], data: Partial<FlowNodeData> = {}): Node<FlowNodeData> {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data,
  } as Node<FlowNodeData>;
}

function edge(id: string, source: string, target: string, disabled = false): Edge {
  return {
    id,
    source,
    target,
    sourceHandle: "out",
    targetHandle: "in",
    animated: true,
    ...(disabled ? { data: { disabled: true } } : {}),
  };
}

describe("useEdgeViewModel pure helpers", () => {
  it("buildEdgeView applies disabled style and turns off animation", () => {
    const out = buildEdgeView([edge("e1", "A", "B", true)], [], {});
    expect(out[0].className).toContain("flowEdgeState--disabled");
    expect(out[0].animated).toBe(false);
  });

  it("buildEdgeView marks running state and keeps animation on", () => {
    const out = buildEdgeView(
      [edge("e1", "A", "B", false)],
      [],
      { A: "running" } as const,
    );
    expect(out[0].className).toContain("flowEdgeState--running");
    expect(out[0].animated).toBe(true);
  });

  it("buildEdgeView marks failed state and turns animation off", () => {
    const out = buildEdgeView(
      [edge("e1", "A", "B", false)],
      [],
      { B: "failed" } as const,
    );
    expect(out[0].className).toContain("flowEdgeState--failed");
    expect(out[0].animated).toBe(false);
  });

  it("buildNodesView highlights linked nodes and dims others", () => {
    const nodes = [node("A", "textNode"), node("B", "imageNode"), node("C", "audioNode")];
    const out = buildNodesView(nodes, {
      edgeId: "e",
      sourceId: "A",
      targetId: "B",
      x: 0,
      y: 0,
      summary: "",
      disabled: false,
    });
    expect(out.find((n) => n.id === "A")?.className).toContain("flowNodeLinkedByEdge");
    expect(out.find((n) => n.id === "B")?.className).toContain("flowNodeLinkedByEdge");
    expect(out.find((n) => n.id === "C")?.className).toContain("flowNodeDimmedByEdge");
  });

  it("summarizeEdgePayloadText includes disabled marker", () => {
    const nodes = [
      node("A", "textNode", { prompt: "hello" }),
      node("B", "imageNode"),
    ];
    const summary = summarizeEdgePayloadText(nodes, "A", "B", true);
    expect(summary).toContain("textNode -> imageNode");
    expect(summary).toContain("已禁用（不参与执行/推导）");
  });
});

