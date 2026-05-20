import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import {
  findIncomingTextNodeId,
  findOutgoingVideoNodeId,
  isPassiveAudioAsset,
} from "./audioNodeContainerMode";

function node(id: string, type: string, data: Partial<FlowNodeData> = {}): Node<FlowNodeData> {
  return {
    id,
    type: type as Node<FlowNodeData>["type"],
    position: { x: 0, y: 0 },
    data: data as FlowNodeData,
  } as Node<FlowNodeData>;
}

function edge(source: string, target: string): Edge {
  return { id: `${source}-${target}`, source, target };
}

describe("audioNodeContainerMode", () => {
  it("isPassiveAudioAsset when asset exists and linked to video", () => {
    const nodes = [
      node("a1", "audioNode", { path: "assets/a.mp3" }),
      node("v1", "videoNode"),
    ];
    const edges = [edge("a1", "v1")];
    expect(isPassiveAudioAsset("a1", nodes, edges)).toBe(true);
  });

  it("is not passive without asset", () => {
    const nodes = [node("a1", "audioNode"), node("v1", "videoNode")];
    const edges = [edge("a1", "v1")];
    expect(isPassiveAudioAsset("a1", nodes, edges)).toBe(false);
  });

  it("is not passive without video outgoing", () => {
    const nodes = [node("a1", "audioNode", { path: "assets/a.mp3" })];
    expect(isPassiveAudioAsset("a1", nodes, [])).toBe(false);
  });

  it("finds linked video and text partners", () => {
    const nodes = [
      node("t1", "textNode"),
      node("a1", "audioNode", { path: "x" }),
      node("v1", "videoNode"),
    ];
    const edges = [edge("t1", "a1"), edge("a1", "v1")];
    expect(findOutgoingVideoNodeId("a1", nodes, edges)).toBe("v1");
    expect(findIncomingTextNodeId("a1", nodes, edges)).toBe("t1");
  });
});
