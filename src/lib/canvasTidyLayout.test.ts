import { describe, expect, it } from "vitest";
import { applyCanvasTidyLayout, computeLayoutPositions } from "./canvasTidyLayout";
import type { FlowNodeData } from "./types";
import type { Node } from "@xyflow/react";

function node(id: string, x: number, y: number, parentId?: string): Node<FlowNodeData> {
  return {
    id,
    type: "textNode",
    position: { x, y },
    data: { label: id },
    parentId,
    measured: { width: 100, height: 80 },
  };
}

describe("canvasTidyLayout", () => {
  it("grid layout places top-level nodes in rows", () => {
    const nodes = [node("a", 0, 0), node("b", 500, 200), node("c", 100, 400)];
    const { nodes: next, movedCount } = applyCanvasTidyLayout(nodes, 40, "grid");
    expect(movedCount).toBe(3);
    expect(next.find((n) => n.id === "a")!.position).toEqual({ x: 0, y: 0 });
    expect(next.find((n) => n.id === "b")!.position.x).toBe(140);
    expect(next.find((n) => n.id === "b")!.position.y).toBe(0);
  });

  it("does not move children inside groups", () => {
    const nodes = [node("g", 0, 0), node("c", 10, 10, "g")];
    const { nodes: next, movedCount } = applyCanvasTidyLayout(nodes);
    expect(movedCount).toBe(1);
    expect(next.find((n) => n.id === "c")!.position).toEqual({ x: 10, y: 10 });
  });

  it("horizontal layout", () => {
    const items = [node("a", 0, 50), node("b", 300, 0)];
    const pos = computeLayoutPositions(items, "horizontal", 40);
    expect(pos.get("b")).toEqual({ x: 0, y: 0 });
    expect(pos.get("a")).toEqual({ x: 140, y: 0 });
  });

  it("grid layout keeps fixed gap for mixed node sizes", () => {
    const items: Node<FlowNodeData>[] = [
      { ...node("a", 0, 0), measured: { width: 320, height: 220 } },
      { ...node("b", 500, 0), measured: { width: 260, height: 160 } },
      { ...node("c", 0, 300), measured: { width: 280, height: 180 } },
      { ...node("d", 500, 300), measured: { width: 300, height: 210 } },
    ];
    const gap = 40;
    const pos = computeLayoutPositions(items, "grid", gap);

    const a = pos.get("a")!;
    const b = pos.get("b")!;
    const c = pos.get("c")!;

    // 同行节点外沿间距固定为 gap
    expect(b.x - (a.x + 320)).toBe(gap);
    // 同列节点外沿间距固定为 gap
    expect(c.y - (a.y + 220)).toBe(gap);
  });
});
