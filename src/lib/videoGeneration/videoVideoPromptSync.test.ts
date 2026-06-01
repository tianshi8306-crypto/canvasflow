import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import {
  applyVideoPromptFromUpstreamVideo,
  buildVideoPromptFromUpstreamVideo,
  patchVideoNodesWithUpstreamVideoPrompt,
} from "@/lib/videoGeneration/videoVideoPromptSync";
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

describe("videoVideoPromptSync", () => {
  it("merges upstream video draft prompts", () => {
    const nodes = [
      node("v1", "videoNode", {
        label: "镜 1",
        video: {
          ...defaultVideoNodePersisted(),
          draft: { ...defaultVideoGenerationDraft(), prompt: "雨夜街道慢推" },
        },
      }),
      node("v2", "videoNode", {
        video: { ...defaultVideoNodePersisted(), draft: defaultVideoGenerationDraft() },
      }),
    ];
    const edges = [edge("v1", "v2")];
    expect(buildVideoPromptFromUpstreamVideo(nodes, edges, "v2")).toBe("雨夜街道慢推");
  });

  it("apply fails when upstream has no prompt", () => {
    const nodes = [
      node("v1", "videoNode", { path: "assets/a.mp4" }),
      node("v2", "videoNode", { video: { ...defaultVideoNodePersisted(), draft: defaultVideoGenerationDraft() } }),
    ];
    const edges = [edge("v1", "v2")];
    const r = applyVideoPromptFromUpstreamVideo(nodes, edges, "v2");
    expect(r.ok).toBe(false);
  });

  it("patch fills empty downstream prompt from upstream video", () => {
    const nodes = [
      node("v1", "videoNode", {
        video: {
          ...defaultVideoNodePersisted(),
          draft: { ...defaultVideoGenerationDraft(), prompt: "延续镜头" },
        },
      }),
      node("v2", "videoNode", {
        video: { ...defaultVideoNodePersisted(), draft: defaultVideoGenerationDraft() },
      }),
    ];
    const edges = [edge("v1", "v2")];
    const next = patchVideoNodesWithUpstreamVideoPrompt(nodes, edges, "v2");
    expect(next.find((n) => n.id === "v2")?.data.video?.draft?.prompt).toBe("延续镜头");
  });
});
