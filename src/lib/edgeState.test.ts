import { describe, expect, it } from "vitest";
import type { Edge } from "@xyflow/react";
import {
  edgeEditingLockedMessage,
  edgeLocateNodeStatusText,
  edgeToggleActionLabel,
  edgeToggleStatusText,
  enabledEdges,
  isEdgeDisabled,
} from "@/lib/edgeState";

function edge(id: string, disabled = false): Edge {
  return {
    id,
    source: "A",
    target: "B",
    sourceHandle: "out",
    targetHandle: "in",
    ...(disabled ? { data: { disabled: true } } : {}),
  };
}

describe("edgeState helpers", () => {
  it("isEdgeDisabled returns true only when data.disabled is true", () => {
    expect(isEdgeDisabled(edge("e1", false))).toBe(false);
    expect(isEdgeDisabled(edge("e2", true))).toBe(true);
  });

  it("enabledEdges filters out disabled edges", () => {
    const edges = [edge("e1"), edge("e2", true), edge("e3")];
    expect(enabledEdges(edges).map((e) => e.id)).toEqual(["e1", "e3"]);
  });

  it("returns consistent edge interaction messages", () => {
    expect(edgeEditingLockedMessage()).toContain("执行中已锁定连线编辑");
    expect(edgeToggleStatusText(true, 2)).toBe("已禁用 2 条连线");
    expect(edgeToggleStatusText(false, 1)).toBe("已启用 1 条连线");
    expect(edgeToggleActionLabel(true, 1)).toBe("禁用连线");
    expect(edgeToggleActionLabel(false, 3)).toBe("启用连线（3）");
    expect(edgeLocateNodeStatusText("upstream", "1234567890")).toBe("已定位上游节点：12345678");
    expect(edgeLocateNodeStatusText("downstream", "abcdefghi")).toBe("已定位下游节点：abcdefgh");
  });
});

