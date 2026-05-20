import { describe, expect, it, beforeEach } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import {
  getFlowClipboard,
  getFlowClipboardCount,
  setFlowClipboard,
} from "./projectClipboard";

describe("projectClipboard", () => {
  beforeEach(() => {
    setFlowClipboard([], []);
  });

  it("getFlowClipboardCount returns 0 initially", () => {
    expect(getFlowClipboardCount()).toBe(0);
  });

  it("setFlowClipboard stores nodes and edges", () => {
    const nodes: Node<FlowNodeData>[] = [
      { id: "n1", type: "imageNode", position: { x: 0, y: 0 }, data: { label: "test" } } as Node<FlowNodeData>,
    ];
    const edges: Edge[] = [
      { id: "e1", source: "n1", target: "n2" } as Edge,
    ];

    setFlowClipboard(nodes, edges);

    const result = getFlowClipboard();
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]!.id).toBe("n1");
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]!.id).toBe("e1");
  });

  it("setFlowClipboard overwrites previous content", () => {
    const nodes1: Node<FlowNodeData>[] = [
      { id: "n1", type: "imageNode", position: { x: 0, y: 0 }, data: {} } as Node<FlowNodeData>,
    ];
    const nodes2: Node<FlowNodeData>[] = [
      { id: "n2", type: "videoNode", position: { x: 100, y: 100 }, data: {} } as Node<FlowNodeData>,
      { id: "n3", type: "audioNode", position: { x: 200, y: 200 }, data: {} } as Node<FlowNodeData>,
    ];

    setFlowClipboard(nodes1, []);
    expect(getFlowClipboardCount()).toBe(1);

    setFlowClipboard(nodes2, []);
    expect(getFlowClipboardCount()).toBe(2);
    expect(getFlowClipboard().nodes[0]!.id).toBe("n2");
  });

  it("getFlowClipboard returns empty arrays when nothing is set", () => {
    const result = getFlowClipboard();
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it("setFlowClipboard with empty arrays clears clipboard", () => {
    setFlowClipboard(
      [{ id: "n1", type: "imageNode", position: { x: 0, y: 0 }, data: {} } as Node<FlowNodeData>],
      [],
    );
    expect(getFlowClipboardCount()).toBe(1);

    setFlowClipboard([], []);
    expect(getFlowClipboardCount()).toBe(0);
    expect(getFlowClipboard().nodes).toEqual([]);
  });
});