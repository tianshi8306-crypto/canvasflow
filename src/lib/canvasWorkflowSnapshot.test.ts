import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import {
  buildWorkflowSnapshotFromSelection,
  buildNodesFromWorkflowSnapshot,
  collectSelectionNodeIds,
  sanitizeWorkflowNodeData,
} from "@/lib/canvasWorkflowSnapshot";

function node(
  id: string,
  type: string,
  x: number,
  y: number,
  extra?: Partial<Node<FlowNodeData>>,
): Node<FlowNodeData> {
  return {
    id,
    type,
    position: { x, y },
    data: { label: id, ...(extra?.data ?? {}) } as FlowNodeData,
    ...extra,
  };
}

describe("canvasWorkflowSnapshot", () => {
  it("collectSelectionNodeIds expands group subtree", () => {
    const nodes = [
      node("g1", "group", 0, 0),
      node("a", "textNode", 10, 10, { parentId: "g1" }),
    ];
    const ids = collectSelectionNodeIds(["g1"], nodes);
    expect(ids.has("g1")).toBe(true);
    expect(ids.has("a")).toBe(true);
  });

  it("sanitizeWorkflowNodeData strips path and assetId", () => {
    const next = sanitizeWorkflowNodeData({
      label: "x",
      path: "assets/x.png",
      assetId: "aid",
      params: { apiKey: "secret", model: "m" },
    });
    expect(next.path).toBeUndefined();
    expect(next.assetId).toBeUndefined();
    expect((next.params as Record<string, unknown>).apiKey).toBeUndefined();
    expect((next.params as Record<string, unknown>).model).toBe("m");
  });

  it("buildWorkflowSnapshotFromSelection normalizes flat selection positions", () => {
    const nodes = [
      node("a", "textNode", 100, 200),
      node("b", "imageNode", 300, 400),
    ];
    const edges: Edge[] = [
      { id: "e1", source: "a", target: "b", sourceHandle: "out", targetHandle: "in" },
    ];
    const snap = buildWorkflowSnapshotFromSelection(nodes, edges, ["a", "b"], "链路");
    expect(snap?.kind).toBe("selection");
    expect(snap?.nodes[0]?.position).toEqual({ x: 0, y: 0 });
    expect(snap?.nodes[1]?.position).toEqual({ x: 200, y: 200 });
    expect(snap?.edges).toHaveLength(1);
  });

  it("round-trip insert preserves edge count", () => {
    const nodes = [
      node("a", "textNode", 0, 0),
      node("b", "imageNode", 200, 0),
    ];
    const edges: Edge[] = [
      { id: "e1", source: "a", target: "b", sourceHandle: "out", targetHandle: "in" },
    ];
    const snap = buildWorkflowSnapshotFromSelection(nodes, edges, ["a", "b"], "t");
    expect(snap).not.toBeNull();
    const { nextNodes, nextEdges } = buildNodesFromWorkflowSnapshot(snap!, { x: 500, y: 500 });
    expect(nextNodes).toHaveLength(2);
    expect(nextEdges).toHaveLength(1);
  });
});
