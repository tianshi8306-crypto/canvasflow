import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import {
  hasParallelEdge,
  normalizeConnection,
  sanitizeCanvasEdges,
  validateConnection,
} from "@/lib/flowConnectionPolicy";

function node(id: string, type: Node<FlowNodeData>["type"]): Node<FlowNodeData> {
  return { id, type, position: { x: 0, y: 0 }, data: {} } as Node<FlowNodeData>;
}

describe("flowConnectionPolicy handle normalization", () => {
  it("accepts legacy input/output handles after normalization", () => {
    const nodes = [node("T", "textNode"), node("I", "imageNode")];
    const verdict = validateConnection(
      { source: "T", target: "I", sourceHandle: "output", targetHandle: "input" },
      nodes,
      [],
    );
    expect(verdict.ok).toBe(true);
  });

  it("sanitizeCanvasEdges migrates legacy handles to in/out", () => {
    const nodes = [node("T", "textNode"), node("I", "imageNode")];
    const edges: Edge[] = [
      {
        id: "e1",
        source: "T",
        target: "I",
        sourceHandle: "output",
        targetHandle: "input",
      },
    ];
    const { edges: cleaned, droppedCount } = sanitizeCanvasEdges(nodes, edges);
    expect(droppedCount).toBe(0);
    expect(cleaned[0]?.sourceHandle).toBe("out");
    expect(cleaned[0]?.targetHandle).toBe("in");
  });

  it("hasParallelEdge detects duplicate source-target", () => {
    const edges: Edge[] = [
      { id: "e1", source: "A", target: "B", sourceHandle: "out", targetHandle: "in" },
    ];
    expect(
      hasParallelEdge(
        edges,
        normalizeConnection({ source: "A", target: "B", sourceHandle: null, targetHandle: null }),
      ),
    ).toBe(true);
    expect(
      hasParallelEdge(
        edges,
        normalizeConnection({ source: "A", target: "C", sourceHandle: null, targetHandle: null }),
      ),
    ).toBe(false);
  });
});
