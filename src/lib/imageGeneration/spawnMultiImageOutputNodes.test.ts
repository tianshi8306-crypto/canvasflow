import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { spawnExtraImageOutputNodes } from "./spawnMultiImageOutputNodes";

const addNodesWithEdges = vi.fn();

vi.mock("@/store/projectStore", () => ({
  useProjectStore: {
    getState: () => ({
      nodes: [
        {
          id: "src",
          type: "imageNode",
          position: { x: 10, y: 20 },
          data: {
            label: "测试图",
            prompt: "prompt",
            params: { scriptBeatId: "beat-1", shotNumber: "1" },
          },
        } as Node<FlowNodeData>,
        {
          id: "script",
          type: "scriptNode",
          position: { x: 0, y: 0 },
          data: {},
        } as Node<FlowNodeData>,
      ],
      edges: [
        {
          id: "e1",
          source: "script",
          target: "src",
          sourceHandle: "out",
          targetHandle: "in",
        },
      ],
      addNodesWithEdges,
    }),
  },
}));

describe("spawnExtraImageOutputNodes", () => {
  beforeEach(() => {
    addNodesWithEdges.mockClear();
  });

  it("creates grid sibling nodes with copied upstream edges", () => {
    const ids = spawnExtraImageOutputNodes({
      sourceNodeId: "src",
      extraRelPaths: ["assets/b.png", "assets/c.png"],
      imageWidth: 1024,
      imageHeight: 576,
    });

    expect(ids).toHaveLength(2);
    expect(addNodesWithEdges).toHaveBeenCalledTimes(1);
    const [nodes, edges] = addNodesWithEdges.mock.calls[0] as [
      Node<FlowNodeData>[],
      { source: string; target: string }[],
    ];
    expect(nodes).toHaveLength(2);
    expect(nodes[0]?.data.path).toBe("assets/b.png");
    expect(nodes[0]?.data.label).toBe("测试图 2");
    expect(nodes[0]?.data.params).toEqual({});
    expect(nodes[1]?.data.label).toBe("测试图 3");
    expect(edges).toHaveLength(2);
    expect(edges.every((e) => e.source === "script")).toBe(true);
  });

  it("binds split-shot assignments to spawned nodes", () => {
    spawnExtraImageOutputNodes({
      sourceNodeId: "src",
      extraRelPaths: ["assets/b.png"],
      splitShotAssignments: [{ beatId: "beat-2", shotNumber: "2" }],
    });
    const [nodes] = addNodesWithEdges.mock.calls[0] as [Node<FlowNodeData>[]];
    expect(nodes[0]?.data.params).toEqual({ scriptBeatId: "beat-2", shotNumber: "2" });
    expect(nodes[0]?.data.label).toBe("镜头 2 图");
  });

  it("returns empty when no extras", () => {
    expect(
      spawnExtraImageOutputNodes({ sourceNodeId: "src", extraRelPaths: [] }),
    ).toEqual([]);
    expect(addNodesWithEdges).not.toHaveBeenCalled();
  });
});
