import { describe, it, expect } from "vitest";
import {
  applyIncomingRefEdgeOrder,
  collectVideoIncomingRefItems,
  detectWorkflow,
  reorderIncomingRefEdgeOrder,
  syncReferenceEdgeOrder,
  type VideoIncomingRefItem,
} from "./useVideoIncomingReferenceItems";
import { remapVideoPromptRefOrder } from "@/lib/seedance/videoPromptAtTokens";
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";

function img(y: number, edgeId = `e-${y}`): VideoIncomingRefItem {
  return {
    kind: "image",
    path: `assets/${y}.png`,
    y,
    edgeId,
    sourceNodeId: `n-${y}`,
    nodeLabel: `图 ${y}`,
  };
}

function vid(y: number): VideoIncomingRefItem {
  return {
    kind: "video",
    path: "assets/v.mp4",
    y,
    edgeId: "ev",
    sourceNodeId: "nv",
    nodeLabel: "视频 1",
  };
}

function aud(y: number): VideoIncomingRefItem {
  return {
    kind: "audio",
    path: "assets/a.mp3",
    y,
    edgeId: "ea",
    sourceNodeId: "na",
    nodeLabel: "音频 1",
  };
}

function node(id: string, type: string, data: Partial<FlowNodeData>, y = 0): Node<FlowNodeData> {
  return { id, type, position: { x: 0, y }, data: data as FlowNodeData };
}

describe("detectWorkflow", () => {
  it("returns image_to_video for 1 image without audio/video", () => {
    expect(detectWorkflow([img(0)], "")).toBe("image_to_video");
  });

  it("returns first_last_frame for 2 images", () => {
    expect(detectWorkflow([img(0), img(100)], "")).toBe("first_last_frame");
  });

  it("returns image_reference for 3+ images", () => {
    expect(detectWorkflow([img(0), img(50), img(100)], "")).toBe("image_reference");
    expect(detectWorkflow([img(0), img(50), img(100), img(150)], "")).toBe("image_reference");
  });

  it("returns video_reference when reference video present", () => {
    expect(detectWorkflow([vid(0), img(100)], "prompt")).toBe("video_reference");
  });

  it("returns multimodal_reference when audio present", () => {
    expect(detectWorkflow([aud(0), img(100)], "")).toBe("multimodal_reference");
  });

  it("returns text_to_video for prompt only", () => {
    expect(detectWorkflow([], "hello")).toBe("text_to_video");
  });

  it("returns text_to_video when text upstream connected", () => {
    expect(
      detectWorkflow(
        [
          {
            kind: "text",
            path: "",
            y: 0,
            edgeId: "et",
            sourceNodeId: "t1",
            nodeLabel: "文本 1",
          },
        ],
        "",
      ),
    ).toBe("text_to_video");
  });

  it("returns null when no inputs", () => {
    expect(detectWorkflow([], "")).toBeNull();
    expect(detectWorkflow([], "   ")).toBeNull();
  });
});

describe("collectVideoIncomingRefItems", () => {
  it("includes text and media upstream without requiring path", () => {
    const nodes = [
      node("t1", "textNode", { label: "文本 3", prompt: "hello" }, 10),
      node("a1", "audioNode", { label: "音频 1" }, 20),
      node("v1", "videoNode", {}, 100),
    ];
    const edges: Edge[] = [
      { id: "e1", source: "t1", target: "v1" },
      { id: "e2", source: "a1", target: "v1" },
    ];
    const items = collectVideoIncomingRefItems("v1", nodes, edges);
    expect(items.map((i) => i.kind)).toEqual(["text", "audio"]);
    expect(items[0]?.nodeLabel).toBe("文本 3");
    expect(items[0]?.textContent).toBe("hello");
  });
});

describe("reference edge order", () => {
  const items: VideoIncomingRefItem[] = [
    { kind: "text", path: "", y: 0, edgeId: "e1", sourceNodeId: "t1", nodeLabel: "文本" },
    { kind: "image", path: "a.png", y: 1, edgeId: "e2", sourceNodeId: "i1", nodeLabel: "图1" },
    { kind: "image", path: "b.png", y: 2, edgeId: "e3", sourceNodeId: "i2", nodeLabel: "图2" },
  ];

  it("applyIncomingRefEdgeOrder respects saved order", () => {
    const ordered = applyIncomingRefEdgeOrder(items, ["e3", "e1", "e2"]);
    expect(ordered.map((i) => i.edgeId)).toEqual(["e3", "e1", "e2"]);
  });

  it("syncReferenceEdgeOrder appends new edges", () => {
    expect(syncReferenceEdgeOrder(["e2", "e1"], items)).toEqual(["e2", "e1", "e3"]);
  });

  it("reorderIncomingRefEdgeOrder swaps strip positions", () => {
    const displayIds = ["e1", "e2", "e3"];
    const next = reorderIncomingRefEdgeOrder(items, undefined, displayIds, "e3", "e1");
    expect(next.slice(0, 3)).toEqual(["e3", "e1", "e2"]);
  });

  it("remapVideoPromptRefOrder updates slot tokens after reorder", () => {
    const before = items;
    const after = applyIncomingRefEdgeOrder(items, ["e3", "e1", "e2"]);
    const prompt = "参考 @图片2 与 @图片3";
    expect(remapVideoPromptRefOrder(prompt, before, after)).toBe("参考 @图片3 与 @图片1");
  });
});
