import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import {
  collectIncomingImagePanelItems,
  incomingImagePanelRefsForDisplay,
} from "@/lib/imageGeneration/collectIncomingImagePanelItems";
import { orderIncomingImagePanelRefs } from "@/lib/imageGeneration/imageReferenceEdgeOrder";

function node(
  id: string,
  type: Node<FlowNodeData>["type"],
  data: Partial<FlowNodeData> = {},
  y = 0,
): Node<FlowNodeData> {
  return {
    id,
    type,
    position: { x: 0, y },
    data: data as FlowNodeData,
  } as Node<FlowNodeData>;
}

function edge(source: string, target: string, id?: string): Edge {
  return {
    id: id ?? `${source}-${target}`,
    source,
    target,
    sourceHandle: "out",
    targetHandle: "in",
  };
}

describe("collectIncomingImagePanelItems", () => {
  it("collects image and text upstream in Y order", () => {
    const target = node("T", "imageNode");
    const text = node("TXT", "textNode", { prompt: "hello text", label: "文案" }, 5);
    const img = node("I", "imageNode", { path: "a.png" }, 20);
    const { items } = collectIncomingImagePanelItems(
      [target, text, img],
      [edge("TXT", "T"), edge("I", "T")],
      "T",
    );
    expect(items.map((i) => [i.kind, i.sourceNodeId])).toEqual([
      ["text", "TXT"],
      ["image", "I"],
    ]);
    expect(items[0]?.kind === "text" && items[0].nodeLabel).toBe("文案");
  });

  it("skips empty text nodes", () => {
    const target = node("T", "imageNode");
    const empty = node("E", "textNode", {}, 0);
    const { items } = collectIncomingImagePanelItems(
      [target, empty],
      [edge("E", "T")],
      "T",
    );
    expect(items).toHaveLength(0);
  });

  it("display strip interleaves text and images with per-kind caps", () => {
    const items = orderIncomingImagePanelRefs(
      [
        {
          kind: "text",
          edgeId: "e1",
          sourceNodeId: "t1",
          y: 0,
          nodeLabel: "T1",
          textContent: "a",
        },
        {
          kind: "image",
          edgeId: "e2",
          sourceNodeId: "i1",
          y: 1,
          nodeLabel: "I1",
          path: "1.png",
        },
        {
          kind: "text",
          edgeId: "e3",
          sourceNodeId: "t2",
          y: 2,
          nodeLabel: "T2",
          textContent: "b",
        },
      ],
      ["e1", "e2", "e3"],
    );
    const display = incomingImagePanelRefsForDisplay(items);
    expect(display.map((i) => i.kind)).toEqual(["text", "image", "text"]);
  });
});
