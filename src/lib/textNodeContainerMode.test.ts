import { describe, expect, it } from "vitest";
import { isPassiveTextContainer } from "@/lib/textNodeContainerMode";
import type { FlowNodeData } from "@/lib/types";
import type { Edge, Node } from "@xyflow/react";

function node(id: string, type: string): Node<FlowNodeData> {
  return { id, type, position: { x: 0, y: 0 }, data: { label: id } };
}

function edge(source: string, target: string): Edge {
  return { id: `${source}-${target}`, source, target };
}

describe("isPassiveTextContainer", () => {
  it("孤立文本节点为主动编辑态（非容器）", () => {
    const nodes = [node("T", "textNode")];
    expect(isPassiveTextContainer("T", nodes, [])).toBe(false);
  });

  it("文本 → 视频/图/脚本/音频 为被动容器", () => {
    for (const [partnerType, pid] of [
      ["videoNode", "V"],
      ["imageNode", "I"],
      ["scriptNode", "S"],
      ["audioNode", "A"],
    ] as const) {
      const nodes = [node("T", "textNode"), node(pid, partnerType)];
      const edges = [edge("T", pid)];
      expect(isPassiveTextContainer("T", nodes, edges)).toBe(true);
    }
  });

  it("图片/视频/脚本 → 文本 为被动容器", () => {
    for (const [partnerType, pid] of [
      ["imageNode", "I"],
      ["videoNode", "V"],
      ["scriptNode", "S"],
    ] as const) {
      const nodes = [node("T", "textNode"), node(pid, partnerType)];
      const edges = [edge(pid, "T")];
      expect(isPassiveTextContainer("T", nodes, edges)).toBe(true);
    }
  });
});
