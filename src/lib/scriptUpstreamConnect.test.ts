import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { applyTextToScriptConnectionFeedback } from "./scriptUpstreamConnect";
import { SCRIPT_PARSE_REQUIREMENT_WITH_UPSTREAM } from "./scriptParseDefaults";

function node(id: string, type: string, data: Partial<FlowNodeData> = {}): Node<FlowNodeData> {
  return { id, type, position: { x: 0, y: 0 }, data: data as FlowNodeData };
}

describe("applyTextToScriptConnectionFeedback", () => {
  it("seeds default parse requirement and selects script when upstream has text", () => {
    const nodes: Node<FlowNodeData>[] = [
      node("t1", "textNode", { prompt: "第一场 内景" }),
      node("s1", "scriptNode", { prompt: "" }),
    ];
    const edges: Edge[] = [{ id: "e1", source: "t1", target: "s1" }];

    let status = "";
    const state = {
      nodes,
      edges,
      updateNodeData: (id: string, patch: { prompt?: string }) => {
        const n = nodes.find((x) => x.id === id);
        if (n && patch.prompt !== undefined) n.data.prompt = patch.prompt;
      },
      setStatusText: (msg: string) => {
        status = msg;
      },
    };

    let selected: string[] = [];
    applyTextToScriptConnectionFeedback(
      () => state as never,
      (partial) => {
        if (typeof partial === "function") {
          const next = partial({ selectedNodeIds: [], selectedNodeId: null } as never);
          if (next.selectedNodeIds) selected = next.selectedNodeIds;
        } else if (partial.selectedNodeIds) {
          selected = partial.selectedNodeIds;
        }
      },
      "s1",
    );

    expect(nodes.find((n) => n.id === "s1")?.data.prompt).toBe(
      SCRIPT_PARSE_REQUIREMENT_WITH_UPSTREAM,
    );
    expect(selected).toEqual(["s1"]);
    expect(status).toContain("AI 解析镜头");
  });
});
