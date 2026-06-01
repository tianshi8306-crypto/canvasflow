import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import {
  buildGroupDuplicatePaste,
  collectGroupSubtreeIds,
  GROUP_DUPLICATE_OFFSET,
} from "@/lib/canvasGroupDuplicate";
import { getNodeWorldPosition } from "@/lib/canvasGroup";

function node(
  id: string,
  type: string,
  pos: { x: number; y: number },
  parentId?: string,
): Node<FlowNodeData> {
  return {
    id,
    type,
    position: pos,
    parentId,
    data: { label: id },
    style: type === "group" ? { width: 400, height: 300 } : undefined,
  };
}

describe("canvasGroupDuplicate", () => {
  it("collectGroupSubtreeIds includes nested group tree", () => {
    const nodes = [
      node("g1", "group", { x: 0, y: 0 }),
      node("g2", "group", { x: 20, y: 20 }, "g1"),
      node("a", "imageNode", { x: 10, y: 10 }, "g2"),
    ];
    expect(collectGroupSubtreeIds(nodes, "g1")).toEqual(new Set(["g1", "g2", "a"]));
  });

  it("buildGroupDuplicatePaste offsets world position once for nested members", () => {
    const nodes = [
      node("g1", "group", { x: 100, y: 100 }),
      node("g2", "group", { x: 30, y: 40 }, "g1"),
      node("a", "imageNode", { x: 50, y: 60 }, "g2"),
    ];
    const result = buildGroupDuplicatePaste(nodes, [], "g1");
    expect(result).not.toBeNull();
    const pastedG1 = result!.nextNodes.find((n) => n.type === "group" && !nodes.some((o) => o.id === n.id));
    const pastedA = result!.nextNodes.find((n) => n.type === "imageNode");
    expect(pastedG1).toBeDefined();
    expect(pastedA).toBeDefined();

    const origAWorld = getNodeWorldPosition(nodes, nodes.find((n) => n.id === "a")!);
    const newAWorld = getNodeWorldPosition(
      [...nodes, ...result!.nextNodes],
      pastedA!,
    );
    expect(newAWorld.x - origAWorld.x).toBe(GROUP_DUPLICATE_OFFSET);
    expect(newAWorld.y - origAWorld.y).toBe(GROUP_DUPLICATE_OFFSET);
  });

  it("group label gets 副本 suffix", () => {
    const nodes = [
      { ...node("g1", "group", { x: 0, y: 0 }), data: { label: "分镜批次" } },
      node("a", "imageNode", { x: 40, y: 40 }, "g1"),
    ];
    const result = buildGroupDuplicatePaste(nodes, [], "g1");
    const pastedGroup = result!.nextNodes.find((n) => n.type === "group");
    expect(pastedGroup?.data.label).toBe("分镜批次 副本");
  });
});
