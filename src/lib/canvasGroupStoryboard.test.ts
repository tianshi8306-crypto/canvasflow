import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import {
  evaluateConvertGroupToStoryboard,
  resolveGroupLinkedScriptNodeId,
  resolveUniqueStoryboardGroupForScript,
} from "@/lib/canvasGroupStoryboard";

function node(
  id: string,
  type: string,
  pos: { x: number; y: number },
  parentId?: string,
  data: Partial<FlowNodeData> = {},
): Node<FlowNodeData> {
  return {
    id,
    type,
    position: pos,
    parentId,
    data: { label: id, ...data },
  };
}

describe("canvasGroupStoryboard", () => {
  const script = node("s1", "scriptNode", { x: 0, y: 0 });
  const group = node("g1", "group", { x: 100, y: 100 }, undefined, { groupKind: "workflow" });
  const img = node("i1", "imageNode", { x: 40, y: 40 }, "g1", {
    params: { scriptBeatId: "b1" },
  });
  const vid = node("v1", "videoNode", { x: 200, y: 40 }, "g1", {
    params: { scriptBeatId: "b2" },
  });
  const nodes = [script, group, img, vid];
  const edges = [{ id: "e1", source: "s1", target: "i1" }];

  it("resolveGroupLinkedScriptNodeId via external edge", () => {
    expect(resolveGroupLinkedScriptNodeId(nodes, edges, "g1")).toBe("s1");
  });

  it("evaluateConvertGroupToStoryboard ok", () => {
    const v = evaluateConvertGroupToStoryboard(nodes, edges, "g1");
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.scriptNodeId).toBe("s1");
      expect(v.beatIds).toContain("b1");
    }
  });

  it("resolveUniqueStoryboardGroupForScript", () => {
    const storyGroup = {
      ...group,
      data: { ...group.data, groupKind: "storyboard" as const },
    };
    const nodes2 = [script, storyGroup, img, vid];
    expect(resolveUniqueStoryboardGroupForScript("s1", nodes2, edges)).toBe("g1");
  });
});
