import { describe, expect, it } from "vitest";
import {
  buildImagePanelTextRefs,
  buildVideoPanelTextRefs,
  expandPromptTextAtReferences,
  resolveMentionNodeTokens,
} from "./promptUpstreamTextRefs";
import type { FlowNodeData } from "./types";
import type { Node } from "@xyflow/react";

describe("expandPromptTextAtReferences", () => {
  const refs = buildImagePanelTextRefs([
    {
      kind: "text",
      edgeId: "e1",
      sourceNodeId: "t1",
      y: 0,
      nodeLabel: "大纲",
      textContent: "赛博朋克城市雨夜",
    },
    {
      kind: "image",
      edgeId: "e2",
      sourceNodeId: "i1",
      y: 1,
      nodeLabel: "参考",
      path: "a.png",
    },
  ]);

  it("expands @文本N with global panel slot", () => {
    const out = expandPromptTextAtReferences("镜头：@文本1，广角", refs);
    expect(out).toBe("镜头：赛博朋克城市雨夜，广角");
  });

  it("expands @[nodeId] and @label", () => {
    const out = expandPromptTextAtReferences("基于 @[t1] 与 @大纲 生成", refs);
    expect(out).toContain("赛博朋克城市雨夜");
    expect(out).not.toContain("@[t1]");
  });
});

describe("buildVideoPanelTextRefs", () => {
  it("uses strip order for @文本N", () => {
    const refs = buildVideoPanelTextRefs([
      {
        kind: "image",
        path: "a.png",
        y: 0,
        edgeId: "e1",
        sourceNodeId: "i1",
        nodeLabel: "图",
      },
      {
        kind: "text",
        path: "",
        y: 1,
        edgeId: "e2",
        sourceNodeId: "t1",
        nodeLabel: "脚本",
        textContent: "主角奔跑",
      },
    ]);
    expect(refs[0]?.panelToken).toBe("@文本2");
  });
});

describe("resolveMentionNodeTokens", () => {
  it("reads textModelInput from upstream node", () => {
    const nodes = [
      {
        id: "up",
        type: "textNode",
        position: { x: 0, y: 0 },
        data: { label: "上游", prompt: "旧正文", params: { textModelInput: "新指令" } },
      },
    ] as Node<FlowNodeData>[];
    const out = resolveMentionNodeTokens("请扩写 @[up]", nodes);
    expect(out).toBe("请扩写 [上游: 新指令]");
  });
});
