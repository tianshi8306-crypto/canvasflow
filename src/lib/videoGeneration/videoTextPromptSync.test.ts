import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import {
  applyVideoPromptFromUpstreamText,
  buildVideoPromptFromUpstreamText,
  patchVideoNodesWithUpstreamTextPrompt,
} from "@/lib/videoGeneration/videoTextPromptSync";
import { defaultVideoGenerationDraft, defaultVideoNodePersisted } from "@/lib/videoNodeTypes";

function node(id: string, type: string, data: Partial<FlowNodeData> = {}): Node<FlowNodeData> {
  return { id, type, position: { x: 0, y: 0 }, data: data as FlowNodeData };
}

function edge(source: string, target: string): Edge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    sourceHandle: "out",
    targetHandle: "in",
  };
}

describe("videoTextPromptSync", () => {
  it("merges upstream text into video prompt", () => {
    const nodes = [
      node("t1", "textNode", { prompt: "雨夜街道，霓虹反射。" }),
      node("v1", "videoNode", { video: { ...defaultVideoNodePersisted(), draft: defaultVideoGenerationDraft() } }),
    ];
    const edges = [edge("t1", "v1")];
    expect(buildVideoPromptFromUpstreamText(nodes, edges, "v1")).toBe("雨夜街道，霓虹反射。");
  });

  it("apply fails when upstream text is empty", () => {
    const nodes = [
      node("t1", "textNode", { prompt: "" }),
      node("v1", "videoNode", { video: { ...defaultVideoNodePersisted(), draft: defaultVideoGenerationDraft() } }),
    ];
    const edges = [edge("t1", "v1")];
    const r = applyVideoPromptFromUpstreamText(nodes, edges, "v1");
    expect(r.ok).toBe(false);
  });

  it("patchVideoNodesWithUpstreamTextPrompt only fills empty prompt", () => {
    const nodes = [
      node("t1", "textNode", { prompt: "上游文案" }),
      node("v1", "videoNode", {
        video: {
          ...defaultVideoNodePersisted(),
          draft: { ...defaultVideoGenerationDraft(), prompt: "已有内容" },
        },
      }),
    ];
    const edges = [edge("t1", "v1")];
    const next = patchVideoNodesWithUpstreamTextPrompt(nodes, edges, "v1");
    expect(next.find((n) => n.id === "v1")?.data.video?.draft?.prompt).toBe("已有内容");
  });

  it("patchVideoNodesWithUpstreamTextPrompt fills when prompt empty", () => {
    const nodes = [
      node("t1", "textNode", { prompt: "自动注入" }),
      node("v1", "videoNode", {
        video: { ...defaultVideoNodePersisted(), draft: defaultVideoGenerationDraft() },
      }),
    ];
    const edges = [edge("t1", "v1")];
    const next = patchVideoNodesWithUpstreamTextPrompt(nodes, edges, "v1");
    expect(next.find((n) => n.id === "v1")?.data.video?.draft?.prompt).toBe("自动注入");
  });
});
