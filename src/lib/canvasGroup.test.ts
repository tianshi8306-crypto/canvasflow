import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import {
  clampGroupDimensionChanges,
  computeGroupSizeFromMembers,
  countGroupMembers,
  GROUP_CONTENT_PADDING,
  GROUP_MIN_HEIGHT,
  GROUP_MIN_WIDTH,
  groupBoundsNodeIds,
  hasGroupInSelection,
  isSingleGroupSelection,
  resolveGroupSelectionIds,
  selectionIdsEqual,
  sortNodesParentBeforeChildren,
  buildGroupExecutionSubgraph,
  collectGroupDescendantIds,
  collectGroupMediaRelPaths,
  findGroupEntryNodeIds,
  getNodeWorldPosition,
  planNestedGroup,
  ungroupNodes,
} from "@/lib/canvasGroup";

function node(id: string, type: string, parentId?: string): Node<FlowNodeData> {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: { label: id },
    parentId,
  };
}

describe("canvasGroup", () => {
  const nodes = [
    node("g1", "group"),
    node("a", "imageNode", "g1"),
    node("b", "videoNode", "g1"),
    node("c", "textNode"),
  ];

  it("countGroupMembers", () => {
    expect(countGroupMembers(nodes, "g1")).toBe(2);
    expect(countGroupMembers(nodes, "missing")).toBe(0);
  });

  it("isSingleGroupSelection", () => {
    expect(isSingleGroupSelection(nodes, ["g1"])).toBe(true);
    expect(isSingleGroupSelection(nodes, ["a"])).toBe(false);
    expect(isSingleGroupSelection(nodes, ["g1", "a"])).toBe(false);
  });

  it("hasGroupInSelection", () => {
    expect(hasGroupInSelection(nodes, ["g1", "a"])).toBe(true);
    expect(hasGroupInSelection(nodes, ["a", "b"])).toBe(false);
  });

  it("groupBoundsNodeIds", () => {
    expect(groupBoundsNodeIds(nodes, "g1")).toEqual(["g1", "a", "b"]);
  });

  it("resolveGroupSelectionIds promotes child to group", () => {
    expect(resolveGroupSelectionIds(nodes, ["a"])).toEqual(["g1"]);
    expect(resolveGroupSelectionIds(nodes, ["g1"])).toEqual(["g1"]);
    expect(resolveGroupSelectionIds(nodes, ["a", "b"])).toEqual(["a", "b"]);
  });

  it("sortNodesParentBeforeChildren places parent before children", () => {
    const g = { ...node("g1", "group"), style: { width: 400, height: 300 } };
    const a = node("a", "imageNode", "g1");
    const sorted = sortNodesParentBeforeChildren([a, g]);
    expect(sorted.map((n) => n.id)).toEqual(["g1", "a"]);
  });

  it("selectionIdsEqual", () => {
    expect(selectionIdsEqual(["a"], ["a"])).toBe(true);
    expect(selectionIdsEqual(["a", "b"], ["a", "b"])).toBe(true);
    expect(selectionIdsEqual(["a"], ["b"])).toBe(false);
    expect(selectionIdsEqual(["a"], ["a", "b"])).toBe(false);
  });

  it("computeGroupSizeFromMembers respects padding and minimums", () => {
    const members = [
      { ...node("a", "imageNode", "g1"), position: { x: 40, y: 40 } },
      { ...node("b", "videoNode", "g1"), position: { x: 360, y: 40 } },
    ];
    const size = computeGroupSizeFromMembers(members);
    expect(size.width).toBeGreaterThanOrEqual(GROUP_MIN_WIDTH);
    expect(size.height).toBeGreaterThanOrEqual(GROUP_MIN_HEIGHT);
    expect(size.width).toBeGreaterThanOrEqual(360 + GROUP_CONTENT_PADDING);
  });

  it("buildGroupExecutionSubgraph finds entries and internal edges", () => {
    const edges = [
      { id: "e1", source: "a", target: "b" },
      { id: "e2", source: "b", target: "c" },
      { id: "e3", source: "x", target: "a" },
    ] as import("@xyflow/react").Edge[];
    const sub = buildGroupExecutionSubgraph(nodes, edges, "g1");
    expect(sub.memberNodes.map((n) => n.id).sort()).toEqual(["a", "b"]);
    expect(sub.memberEdges).toHaveLength(1);
    expect(sub.entryNodeIds).toEqual(["a"]);
  });

  it("collectGroupMediaRelPaths dedupes paths", () => {
    const mediaNodes = [
      { ...node("a", "imageNode", "g1"), data: { label: "a", path: "assets/a.png" } },
      { ...node("b", "videoNode", "g1"), data: { label: "b", path: "assets/a.png" } },
      { ...node("c", "textNode", "g1"), data: { label: "c" } },
    ];
    expect(collectGroupMediaRelPaths([...nodes, ...mediaNodes], "g1")).toEqual(["assets/a.png"]);
  });

  it("findGroupEntryNodeIds", () => {
    const ids = new Set(["a", "b", "c"]);
    const edges = [
      { id: "e1", source: "a", target: "b" },
      { id: "e2", source: "b", target: "c" },
    ] as import("@xyflow/react").Edge[];
    expect(findGroupEntryNodeIds(ids, edges)).toEqual(["a"]);
  });

  it("planNestedGroup nests inside parent group with world coords", () => {
    const outer = {
      ...node("g1", "group"),
      position: { x: 100, y: 100 },
      style: { width: 600, height: 400 },
    };
    const innerA = { ...node("a", "imageNode", "g1"), position: { x: 40, y: 40 } };
    const innerB = { ...node("b", "videoNode", "g1"), position: { x: 320, y: 40 } };
    const nested = [outer, innerA, innerB];
    const verdict = planNestedGroup(nested, ["a", "b"]);
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.plan.parentId).toBe("g1");
    expect(verdict.plan.roots.map((r) => r.id).sort()).toEqual(["a", "b"]);
    expect(getNodeWorldPosition(nested, innerA).x).toBe(140);
  });

  it("ungroupNodes keeps children in outer parent", () => {
    const outer = { ...node("g1", "group"), position: { x: 50, y: 50 }, style: { width: 500, height: 400 } };
    const inner = {
      ...node("g2", "group", "g1"),
      position: { x: 20, y: 20 },
      style: { width: 300, height: 200 },
    };
    const leaf = { ...node("a", "imageNode", "g2"), position: { x: 10, y: 10 } };
    const all = [outer, inner, leaf];
    const after = ungroupNodes(all, "g2");
    const a = after.find((n) => n.id === "a");
    expect(a?.parentId).toBe("g1");
    expect(a?.position).toEqual({ x: 30, y: 30 });
  });

  it("buildGroupExecutionSubgraph includes nested group executables", () => {
    const outer = { ...node("g1", "group"), position: { x: 0, y: 0 }, style: { width: 800, height: 600 } };
    const inner = {
      ...node("g2", "group", "g1"),
      position: { x: 40, y: 40 },
      style: { width: 400, height: 300 },
    };
    const a = { ...node("a", "imageNode", "g2"), position: { x: 20, y: 20 } };
    const b = { ...node("b", "videoNode", "g2"), position: { x: 200, y: 20 } };
    const edges = [{ id: "e1", source: "a", target: "b" }] as import("@xyflow/react").Edge[];
    const sub = buildGroupExecutionSubgraph([outer, inner, a, b], edges, "g1");
    expect(sub.memberNodes.map((n) => n.id).sort()).toEqual(["a", "b"]);
    expect(collectGroupDescendantIds([outer, inner, a, b], "g1")).toEqual(new Set(["a", "b"]));
  });

  it("clampGroupDimensionChanges enforces member bounds", () => {
    const group = { ...node("g1", "group"), style: { width: 400, height: 300 } };
    const members = [
      { ...node("a", "imageNode", "g1"), position: { x: 40, y: 40 } },
    ];
    const all = [group, ...members];
    const min = computeGroupSizeFromMembers(members);
    const out = clampGroupDimensionChanges(
      [
        {
          id: "g1",
          type: "dimensions",
          dimensions: { width: 100, height: 100 },
        },
      ],
      all,
    );
    expect(out[0]).toMatchObject({
      type: "dimensions",
      dimensions: { width: min.width, height: min.height },
    });
  });
});
