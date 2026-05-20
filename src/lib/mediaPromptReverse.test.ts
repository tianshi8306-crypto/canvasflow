import { describe, expect, it } from "vitest";
import { findDownstreamTextNodeId } from "@/lib/mediaPromptReverse";
import type { FlowNodeData } from "@/lib/types";
import type { Edge, Node } from "@xyflow/react";

function node(id: string, type: string): Node<FlowNodeData> {
  return { id, type, position: { x: 0, y: 0 }, data: { label: id } };
}

function edge(source: string, target: string): Edge {
  return { id: `${source}-${target}`, source, target };
}

describe("findDownstreamTextNodeId", () => {
  it("returns text node on outgoing edge", () => {
    const nodes = [node("I", "imageNode"), node("T", "textNode")];
    const edges = [edge("I", "T")];
    expect(findDownstreamTextNodeId("I", nodes, edges)).toBe("T");
  });

  it("returns null without text downstream", () => {
    const nodes = [node("I", "imageNode"), node("V", "videoNode")];
    const edges = [edge("I", "V")];
    expect(findDownstreamTextNodeId("I", nodes, edges)).toBeNull();
  });
});
