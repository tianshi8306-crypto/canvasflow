import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import {
  firstSeedanceAudioAtToken,
  listVideoUpstreamAudioSources,
  videoUpstreamAudioStatusMessage,
} from "@/lib/videoGeneration/videoAudioPromptSync";

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

describe("videoAudioPromptSync", () => {
  it("lists upstream audio with path for Seedance reference", () => {
    const nodes = [
      node("a1", "audioNode", { label: "旁白", path: "assets/narration.mp3", prompt: "雨夜独白" }),
      node("v1", "videoNode", {}),
    ];
    const edges = [edge("a1", "v1")];
    const sources = listVideoUpstreamAudioSources(nodes, edges, "v1");
    expect(sources).toHaveLength(1);
    expect(sources[0]?.hasPath).toBe(true);
    expect(sources[0]?.ttsCharCount).toBe(4);
    expect(videoUpstreamAudioStatusMessage(sources)).toContain("参考音频已就绪");
  });

  it("resolves first @声音N token from ref strip mapping", () => {
    const sources = [
      { nodeId: "a1", label: "旁白", hasPath: true, relPath: "x.mp3", ttsCharCount: 0 },
    ];
    const map = new Map([["a1", "@声音2"]]);
    expect(firstSeedanceAudioAtToken(sources, map)).toBe("@声音2");
  });
});
