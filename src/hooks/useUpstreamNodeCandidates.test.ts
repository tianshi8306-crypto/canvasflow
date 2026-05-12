import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useProjectStore } from "@/store/projectStore";
import { useUpstreamNodeCandidates } from "./useUpstreamNodeCandidates";
import type { Node, Edge } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";

function node(id: string, type: string, data: Partial<FlowNodeData> = {}): Node<FlowNodeData> {
  return {
    id,
    type: type as Node<FlowNodeData>["type"],
    position: { x: 0, y: 0 },
    data: data as FlowNodeData,
  } as Node<FlowNodeData>;
}

function edge(id: string, source: string, target: string): Edge {
  return { id, source, target };
}

function setupStore(nodes: Node<FlowNodeData>[], edges: Edge[]) {
  useProjectStore.setState({ nodes, edges });
}

describe("useUpstreamNodeCandidates", () => {
  it("returns empty array when node has no upstream edges", () => {
    setupStore([node("A", "textNode")], []);
    const { result } = renderHook(() => useUpstreamNodeCandidates("A"));
    expect(result.current).toEqual([]);
  });

  it("returns upstream nodes connected via edges", () => {
    setupStore(
      [node("A", "textNode", { label: "Source Node" }), node("B", "llm")],
      [edge("e1", "A", "B")],
    );
    const { result } = renderHook(() => useUpstreamNodeCandidates("B"));
    expect(result.current).toEqual([{ id: "A", type: "textNode", label: "Source Node" }]);
  });

  it("excludes the current node from candidates", () => {
    setupStore(
      [node("A", "textNode", { label: "Self" }), node("B", "llm")],
      [edge("e1", "A", "B"), edge("e2", "B", "B")],
    );
    const { result } = renderHook(() => useUpstreamNodeCandidates("B"));
    const ids = result.current.map((c) => c.id);
    expect(ids).not.toContain("B");
  });

  it("handles nodes with no label (falls back to nodeId)", () => {
    setupStore(
      [node("A", "textNode"), node("B", "llm")],
      [edge("e1", "A", "B")],
    );
    const { result } = renderHook(() => useUpstreamNodeCandidates("B"));
    expect(result.current).toEqual([{ id: "A", type: "textNode", label: "A" }]);
  });
});
