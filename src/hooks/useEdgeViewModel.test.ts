import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { buildEdgeView, buildNodesView } from "@/hooks/useEdgeViewModel";

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

  it("buildEdgeView applies active stroke when selected", () => {
    const out = buildEdgeView([edge("e1", "A", "B", false)], ["e1"], {});
    expect(out[0].style?.stroke).toBe("#7dd3fc");
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

  it("buildNodesView syncs selected from store and strips dragging", () => {
    const nodes = [
      { ...node("A", "textNode"), selected: true, dragging: true },
      node("B", "imageNode"),
    ];
    const out = buildNodesView(nodes, ["B"]);
    expect(out.find((n) => n.id === "A")?.selected).toBe(false);
    expect(out.find((n) => n.id === "B")?.selected).toBe(true);
    expect(out.find((n) => n.id === "A")?.dragging).toBeUndefined();
  });

  it("buildNodesView elevates single-selected node for chrome stacking", () => {
    const out = buildNodesView([node("A", "imageNode"), node("B", "videoNode")], ["B"]);
    expect(out.find((n) => n.id === "B")?.zIndex).toBe(1000);
    expect(out.find((n) => n.id === "B")?.className).toContain("flowNodeChromeFocus");
    expect(out.find((n) => n.id === "A")?.zIndex).toBeUndefined();
  });
});

