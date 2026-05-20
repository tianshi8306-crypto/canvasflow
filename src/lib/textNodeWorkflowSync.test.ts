import { describe, expect, it } from "vitest";
import {
  applyTextWorkflowPatch,
  applyTextWorkflowSyncToNodes,
  inferTextWorkflowPatch,
} from "@/lib/textNodeWorkflowSync";
import type { FlowNodeData } from "@/lib/types";
import type { Edge, Node } from "@xyflow/react";

function textNode(id: string): Node<FlowNodeData> {
  return { id, type: "textNode", position: { x: 0, y: 0 }, data: { label: "t" } };
}

function partner(id: string, type: string): Node<FlowNodeData> {
  return { id, type, position: { x: 0, y: 0 }, data: { label: type } };
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

describe("inferTextWorkflowPatch", () => {
  it("prefers outgoing video", () => {
    const nodes = [textNode("t1"), partner("v1", "videoNode")];
    const edges = [edge("t1", "v1")];
    expect(inferTextWorkflowPatch("t1", nodes, edges)).toEqual({
      textWorkflow: "textToVideo",
      videoNodeId: "v1",
    });
  });

  it("detects incoming video as videoToPrompt", () => {
    const nodes = [textNode("t1"), partner("v1", "videoNode")];
    const edges = [edge("v1", "t1")];
    expect(inferTextWorkflowPatch("t1", nodes, edges)).toEqual({
      textWorkflow: "videoToPrompt",
      videoNodeId: "v1",
    });
  });

  it("detects outgoing script as textToScript", () => {
    const nodes = [textNode("t1"), partner("s1", "scriptNode")];
    const edges = [edge("t1", "s1")];
    expect(inferTextWorkflowPatch("t1", nodes, edges)).toEqual({
      textWorkflow: "textToScript",
      scriptNodeId: "s1",
    });
  });

  it("clears workflow when isolated", () => {
    const nodes = [textNode("t1")];
    expect(inferTextWorkflowPatch("t1", nodes, [])).toEqual({
      textWorkflow: undefined,
      videoNodeId: undefined,
      audioNodeId: undefined,
      scriptNodeId: undefined,
      imageNodeId: undefined,
    });
  });
});

describe("applyTextWorkflowSyncToNodes", () => {
  it("updates only text nodes in one pass", () => {
    const nodes = [textNode("t1"), partner("v1", "videoNode")];
    const edges = [edge("t1", "v1")];
    const next = applyTextWorkflowSyncToNodes(nodes, edges);
    expect(next).not.toBe(nodes);
    const t1 = next.find((n) => n.id === "t1");
    expect((t1?.data.params as { textWorkflow?: string })?.textWorkflow).toBe("textToVideo");
  });
});

describe("applyTextWorkflowPatch", () => {
  it("removes stale video id when switching to music", () => {
    const next = applyTextWorkflowPatch(
      { textWorkflow: "textToVideo", videoNodeId: "v1" },
      { textWorkflow: "textToMusic", audioNodeId: "a1" },
    );
    expect(next.textWorkflow).toBe("textToMusic");
    expect(next.audioNodeId).toBe("a1");
    expect(next.videoNodeId).toBeUndefined();
  });
});
