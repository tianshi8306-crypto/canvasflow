import { describe, expect, it } from "vitest";
import {
  listScriptUpstreamTextSources,
  scriptUpstreamImportStatusMessage,
} from "@/lib/scriptUpstreamText";
import type { FlowNodeData } from "@/lib/types";
import type { Edge, Node } from "@xyflow/react";

function node(id: string, type: string, data: Partial<FlowNodeData>): Node<FlowNodeData> {
  return { id, type, position: { x: 0, y: 0 }, data: data as FlowNodeData };
}

describe("scriptUpstreamText", () => {
  it("lists enabled upstream text sources", () => {
    const nodes = [
      node("t1", "textNode", { label: "全集剧本", prompt: "第一幕\n第二幕" }),
      node("s1", "scriptNode", { label: "脚本", prompt: "解析要求：分镜表" }),
    ];
    const edges: Edge[] = [{ id: "e1", source: "t1", target: "s1" }];
    const sources = listScriptUpstreamTextSources(nodes, edges, "s1");
    expect(sources).toHaveLength(1);
    expect(sources[0]?.charCount).toBeGreaterThan(5);
    expect(scriptUpstreamImportStatusMessage(sources)).toContain("全集剧本");
  });

  it("returns empty when edge disabled", () => {
    const nodes = [
      node("t1", "textNode", { prompt: "剧本" }),
      node("s1", "scriptNode", { prompt: "要求" }),
    ];
    const edges: Edge[] = [{ id: "e1", source: "t1", target: "s1", data: { disabled: true } }];
    expect(listScriptUpstreamTextSources(nodes, edges, "s1")).toHaveLength(0);
  });
});
