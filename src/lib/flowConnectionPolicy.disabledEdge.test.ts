import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { validateConnection } from "@/lib/flowConnectionPolicy";

function node(id: string, type: Node<FlowNodeData>["type"], y = 0): Node<FlowNodeData> {
  return {
    id,
    type,
    position: { x: 0, y },
    data: {},
  } as Node<FlowNodeData>;
}

function edge(source: string, target: string, disabled = false): Edge {
  return {
    id: `${source}-${target}-${disabled ? "d" : "e"}`,
    source,
    target,
    sourceHandle: "out",
    targetHandle: "in",
    ...(disabled ? { data: { disabled: true } } : {}),
  };
}

describe("flowConnectionPolicy disabled edge behavior", () => {
  it("validateConnection ignores disabled back-edge in cycle detection", () => {
    // 若存在启用路径 A->…->C，再连 C->A 会形成有向环；此处只保留 C->A（禁用）与 A->B，
    // 在忽略禁用边后 A 到 C 无 walk，新连 C->A 不应被误判为成环。
    const nodes = [node("A", "textNode"), node("B", "textNode"), node("C", "textNode")];
    const edges: Edge[] = [edge("A", "B"), edge("C", "A", true)];
    const verdict = validateConnection(
      { source: "C", target: "A", sourceHandle: "out", targetHandle: "in" },
      nodes,
      edges,
    );
    expect(verdict.ok).toBe(true);
  });
});

