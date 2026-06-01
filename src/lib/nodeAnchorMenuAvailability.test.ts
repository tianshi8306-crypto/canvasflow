import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { isAnchorMenuRowAvailable } from "@/lib/nodeAnchorMenuAvailability";
import type { AnchorMenuGraphContext } from "@/lib/nodeAnchorMenus";
import { getIncomingMenuRows, getOutgoingMenuRows } from "@/lib/nodeAnchorMenus";

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

function ctx(anchorNodeId: string, nodes: Node<FlowNodeData>[], edges: Edge[]): AnchorMenuGraphContext {
  return { anchorNodeId, nodes, edges };
}

describe("nodeAnchorMenuAvailability P3", () => {
  it("hides second script upstream on imageNode", () => {
    const nodes = [node("S1", "scriptNode"), node("I1", "imageNode")];
    const edges = [edge("S1", "I1")];
    const c = ctx("I1", nodes, edges);
    expect(isAnchorMenuRowAvailable(c, "imageNode", "incoming", "scriptNode")).toBe(false);
    expect(getIncomingMenuRows("imageNode", c).some((r) => r.key === "scriptNode")).toBe(false);
  });

  it("hides duplicate text→video outgoing when video already linked", () => {
    const nodes = [node("T1", "textNode"), node("V1", "videoNode")];
    const edges = [edge("T1", "V1")];
    const c = ctx("T1", nodes, edges);
    expect(isAnchorMenuRowAvailable(c, "textNode", "outgoing", "videoNode")).toBe(false);
    expect(getOutgoingMenuRows("textNode", c).some((r) => r.key === "videoNode")).toBe(false);
  });

  it("hides script self-loop on script incoming", () => {
    const nodes = [node("S1", "scriptNode")];
    const c = ctx("S1", nodes, []);
    expect(isAnchorMenuRowAvailable(c, "scriptNode", "incoming", "scriptNode")).toBe(false);
  });

  it("without ctx returns policy-only rows (backward compatible)", () => {
    expect(getIncomingMenuRows("scriptNode").some((r) => r.key === "textNode")).toBe(true);
  });
});
