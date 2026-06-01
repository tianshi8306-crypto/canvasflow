import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import {
  applyGroupMembershipAfterDrag,
  findInnermostGroupAtPoint,
  reconcileNodeGroupMembership,
} from "@/lib/canvasGroupMembership";

function n(
  id: string,
  type: string,
  opts?: { parentId?: string; pos?: { x: number; y: number }; style?: { width: number; height: number } },
): Node<FlowNodeData> {
  return {
    id,
    type,
    position: opts?.pos ?? { x: 0, y: 0 },
    parentId: opts?.parentId,
    data: { label: id },
    style: opts?.style,
  };
}

describe("canvasGroupMembership", () => {
  const outer = n("g1", "group", {
    pos: { x: 0, y: 0 },
    style: { width: 600, height: 500 },
  });
  const inner = n("g2", "group", {
    parentId: "g1",
    pos: { x: 50, y: 50 },
    style: { width: 300, height: 250 },
  });

  it("findInnermostGroupAtPoint prefers nested group", () => {
    const nodes = [outer, inner];
    const hit = findInnermostGroupAtPoint(nodes, 200, 200);
    expect(hit).toBe("g2");
  });

  it("reconcile detaches member when center leaves group", () => {
    const member = n("a", "imageNode", {
      parentId: "g1",
      pos: { x: 100, y: 100 },
    });
    const far = {
      ...member,
      position: { x: 700, y: 400 },
    };
    const { nodes: next } = reconcileNodeGroupMembership([outer, far], "a");
    const after = next.find((x) => x.id === "a");
    expect(after?.parentId).toBeUndefined();
    expect(after?.position).toEqual({ x: 700, y: 400 });
  });

  it("reconcile attaches canvas node when dropped inside group", () => {
    const free = n("b", "videoNode", { pos: { x: 120, y: 120 } });
    const { nodes: next } = reconcileNodeGroupMembership([outer, free], "b");
    const after = next.find((x) => x.id === "b");
    expect(after?.parentId).toBe("g1");
    expect(after?.position.x).toBe(120);
    expect(after?.position.y).toBe(120);
  });

  it("applyGroupMembershipAfterDrag on position end", () => {
    const member = n("a", "imageNode", {
      parentId: "g1",
      pos: { x: 50, y: 50 },
    });
    const moved = { ...member, position: { x: 700, y: 400 } };
    const next = applyGroupMembershipAfterDrag([outer, moved], [
      { id: "a", type: "position", position: moved.position, dragging: false },
    ]);
    expect(next.find((x) => x.id === "a")?.parentId).toBeUndefined();
    expect(next.find((x) => x.id === "g1")?.data.label).toBe("分组");
  });
});
