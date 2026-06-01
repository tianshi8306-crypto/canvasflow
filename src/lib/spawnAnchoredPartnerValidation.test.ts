import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { validateConnection } from "@/lib/flowConnectionPolicy";

function node(id: string, type: Node<FlowNodeData>["type"]): Node<FlowNodeData> {
  return { id, type, position: { x: 0, y: 0 }, data: {} } as Node<FlowNodeData>;
}

/**
 * spawnAnchoredPartner 在落库前校验连线；必须把即将创建的 partner 一并传入 nodes，
 * 否则 target 不在图中会恒为「无法识别节点信息」。
 */
describe("spawnAnchoredPartner connection validation", () => {
  it("outgoing edge fails without partner in nodes, succeeds when included", () => {
    const anchor = node("a", "imageNode");
    const partner = node("p", "videoNode");
    const conn = {
      source: "a",
      target: "p",
      sourceHandle: "out" as const,
      targetHandle: "in" as const,
    };
    expect(validateConnection(conn, [anchor], []).ok).toBe(false);
    expect(validateConnection(conn, [anchor, partner], []).ok).toBe(true);
  });

  it("incoming edge fails without partner in nodes, succeeds when included", () => {
    const anchor = node("a", "videoNode");
    const partner = node("p", "imageNode");
    const conn = {
      source: "p",
      target: "a",
      sourceHandle: "out" as const,
      targetHandle: "in" as const,
    };
    expect(validateConnection(conn, [anchor], []).ok).toBe(false);
    expect(validateConnection(conn, [anchor, partner], []).ok).toBe(true);
  });
});
