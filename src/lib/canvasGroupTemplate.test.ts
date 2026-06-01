import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import {
  buildGroupTemplateSnapshot,
  buildNodesFromGroupTemplate,
} from "@/lib/canvasGroupTemplate";

describe("canvasGroupTemplate", () => {
  const group: Node<FlowNodeData> = {
    id: "g1",
    type: "group",
    position: { x: 10, y: 20 },
    style: { width: 400, height: 300 },
    data: { label: "测试组" },
  };
  const img: Node<FlowNodeData> = {
    id: "i1",
    type: "imageNode",
    position: { x: 50, y: 60 },
    parentId: "g1",
    data: { label: "图", path: "assets/x.png", params: { scriptBeatId: "b1" } },
  };
  const nodes = [group, img];

  it("buildGroupTemplateSnapshot strips paths", () => {
    const tpl = buildGroupTemplateSnapshot(nodes, [], "g1", "模板A");
    expect(tpl?.nodes[0]?.data.path).toBeUndefined();
    expect(tpl?.group.data.groupKind).toBe("workflow");
  });

  it("buildNodesFromGroupTemplate preserves nesting", () => {
    const tpl = buildGroupTemplateSnapshot(nodes, [], "g1", "模板A")!;
    const { nextNodes } = buildNodesFromGroupTemplate(tpl, { x: 200, y: 300 });
    const g = nextNodes.find((n) => n.type === "group");
    const child = nextNodes.find((n) => n.parentId === g?.id);
    expect(g?.position).toEqual({ x: 200, y: 300 });
    expect(child?.type).toBe("imageNode");
  });
});
