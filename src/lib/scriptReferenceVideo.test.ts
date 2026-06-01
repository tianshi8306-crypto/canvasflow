import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import {
  buildReferenceVideoPromptBlock,
  listScriptReferenceVideoSources,
  scriptReferenceVideoStatusMessage,
} from "@/lib/scriptReferenceVideo";

function node(id: string, type: string, data: Partial<FlowNodeData>): Node<FlowNodeData> {
  return { id, type, position: { x: 0, y: 0 }, data: data as FlowNodeData };
}

describe("scriptReferenceVideo", () => {
  it("lists enabled upstream video sources with paths", () => {
    const nodes = [
      node("v1", "videoNode", { label: "样片 A", path: "assets/ref-a.mp4" }),
      node("s1", "scriptNode", { label: "脚本", prompt: "按参考节奏切镜" }),
    ];
    const edges: Edge[] = [{ id: "e1", source: "v1", target: "s1" }];
    const sources = listScriptReferenceVideoSources(nodes, edges, "s1");
    expect(sources).toHaveLength(1);
    expect(sources[0]?.relPath).toBe("assets/ref-a.mp4");
    expect(scriptReferenceVideoStatusMessage(sources)).toContain("样片 A");
    const block = buildReferenceVideoPromptBlock(sources);
    expect(block).toContain("assets/ref-a.mp4");
    expect(block).toContain("【参考视频】");
  });

  it("returns empty when edge disabled", () => {
    const nodes = [
      node("v1", "videoNode", { path: "assets/x.mp4" }),
      node("s1", "scriptNode", { prompt: "要求" }),
    ];
    const edges: Edge[] = [{ id: "e1", source: "v1", target: "s1", data: { disabled: true } }];
    expect(listScriptReferenceVideoSources(nodes, edges, "s1")).toHaveLength(0);
  });
});
