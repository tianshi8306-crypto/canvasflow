import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { buildForkDuplicatePaste } from "./createNodeForkDuplicate";
import {
  CANVAS_NODE_LAYOUT_GAP,
  GEN_PANEL_LAYOUT_ESTIMATE_H,
  GEN_PANEL_LAYOUT_GAP,
  resolveNodeLayoutFootprint,
} from "@/lib/nodeLayout";
import { computeVideoNodeFrameSize } from "@/lib/videoGeneration/videoAspectSize";

function node(
  id: string,
  type: string,
  pos: { x: number; y: number },
  data: Partial<FlowNodeData> = {},
): Node<FlowNodeData> {
  return {
    id,
    type,
    position: pos,
    data: { label: id, ...data } as FlowNodeData,
  };
}

function edge(id: string, source: string, target: string): Edge {
  return { id, source, target, sourceHandle: "out", targetHandle: "in" };
}

function videoFootprintH(includeGenPanel = true): number {
  const shell = computeVideoNodeFrameSize(16 / 9).height;
  if (!includeGenPanel) return shell;
  return shell + GEN_PANEL_LAYOUT_GAP + GEN_PANEL_LAYOUT_ESTIMATE_H;
}

describe("resolveNodeLayoutFootprint", () => {
  it("uses frame size for video nodes instead of 200px default", () => {
    const n = node("v1", "videoNode", { x: 0, y: 0 });
    const shell = resolveNodeLayoutFootprint(n);
    const frame = computeVideoNodeFrameSize(16 / 9);
    expect(shell).toEqual({ w: frame.width, h: frame.height });
    const expanded = resolveNodeLayoutFootprint(n, { includeGenPanel: true });
    expect(expanded.h).toBe(videoFootprintH(true));
  });
});

describe("buildForkDuplicatePaste", () => {
  it("forks node with upstream edges only", () => {
    const nodes = [
      node("img1", "imageNode", { x: 0, y: 0 }, { path: "assets/a.png" }),
      node("vid1", "videoNode", { x: 200, y: 0 }, {
        path: "assets/out.mp4",
        video: {
          draft: {
            prompt: "test",
            workflow: "text_to_video",
            modelId: "doubao_seedance_2_0",
            output: {
              aspectRatio: "16:9",
              resolution: "720P",
              durationSec: 5,
              generateAudio: true,
              watermark: false,
            },
          },
        },
      }),
      node("down1", "ffmpegConcat", { x: 400, y: 0 }),
    ];
    const edges = [edge("e1", "img1", "vid1"), edge("e2", "vid1", "down1")];

    const built = buildForkDuplicatePaste(nodes, edges, ["vid1"]);
    expect(built).not.toBeNull();
    expect(built!.newNodeIds).toHaveLength(1);

    const forkId = built!.newNodeIds[0]!;
    const fork = built!.nextNodes[0]!;
    expect(fork.id).toBe(forkId);
    expect(fork.position).toEqual({
      x: 200,
      y: videoFootprintH() + CANVAS_NODE_LAYOUT_GAP,
    });
    expect(fork.data.label).toContain("副本");
    expect(fork.data.path).toBe("");
    expect(fork.data.video?.draft?.prompt).toBe("test");

    expect(built!.nextEdges).toHaveLength(1);
    expect(built!.nextEdges[0]).toMatchObject({ source: "img1", target: forkId });
    expect(built!.nextEdges.some((e) => e.target === "down1")).toBe(false);
  });

  it("returns null for group nodes", () => {
    const nodes = [node("g1", "group", { x: 0, y: 0 })];
    expect(buildForkDuplicatePaste(nodes, [], ["g1"])).toBeNull();
  });

  it("stacks further below when first slot is blocked", () => {
    const belowY = videoFootprintH() + CANVAS_NODE_LAYOUT_GAP;
    const nodes = [
      node("vid1", "videoNode", { x: 100, y: 0 }),
      node("block", "textNode", { x: 100, y: belowY }),
    ];
    const built = buildForkDuplicatePaste(nodes, [], ["vid1"]);
    expect(built!.nextNodes[0]!.position).toEqual({
      x: 100,
      y: belowY + videoFootprintH() + CANVAS_NODE_LAYOUT_GAP,
    });
  });

  it("places fork to the right when below column is blocked", () => {
    const belowY = videoFootprintH() + CANVAS_NODE_LAYOUT_GAP;
    const nodes = [
      node("vid1", "videoNode", { x: 100, y: 0 }),
      {
        ...node("block", "textNode", { x: 100, y: belowY }),
        measured: { width: 280, height: 3200 },
      },
    ];
    const built = buildForkDuplicatePaste(nodes, [], ["vid1"]);
    expect(built!.nextNodes[0]!.position).toEqual({
      x: 100 + computeVideoNodeFrameSize(16 / 9).width + CANVAS_NODE_LAYOUT_GAP,
      y: 0,
    });
  });
});
