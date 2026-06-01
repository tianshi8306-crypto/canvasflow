import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import {
  buildScriptPromptFromUpstreamText,
  incomingScriptUpstreamState,
  incomingTextUpstreamState,
  orderedIncomingScriptNodeIds,
  orderedIncomingTextNodeIds,
} from "@/lib/incomingScriptBinding";
import {
  inspectorScriptUpstreamHint,
  scriptSyncButtonTitle,
  scriptSyncDisabledOnlyStatus,
} from "@/lib/incomingScriptBinding";
import { getIncomingImageRefForNode } from "@/lib/incomingImageReference";
import { computeNextLeftInputY } from "@/lib/videoInputNodeLayout";

function node(id: string, type: Node<FlowNodeData>["type"], y = 0): Node<FlowNodeData> {
  return {
    id,
    type,
    position: { x: 0, y },
    data: {},
  } as Node<FlowNodeData>;
}

function edge(source: string, target: string, disabled = false): Edge {
  return {
    id: `${source}-${target}-${disabled ? "d" : "e"}`,
    source,
    target,
    sourceHandle: "out",
    targetHandle: "in",
    ...(disabled ? { data: { disabled: true } } : {}),
  };
}

describe("incoming bindings ignore disabled edges", () => {
  it("orderedIncomingScriptNodeIds filters disabled incoming edges", () => {
    const script1 = node("S1", "scriptNode", 10);
    const script2 = node("S2", "scriptNode", 20);
    const target = node("IMG", "imageNode", 30);
    const nodes = [script1, script2, target];
    const edges: Edge[] = [edge("S1", "IMG"), edge("S2", "IMG", true)];
    const ids = orderedIncomingScriptNodeIds(nodes, edges, "IMG");
    expect(ids).toEqual(["S1"]);
  });

  it("incomingScriptUpstreamState returns disabled_only when only disabled script edges exist", () => {
    const script = node("S", "scriptNode", 10);
    const target = node("IMG", "imageNode", 30);
    const nodes = [script, target];
    const edges: Edge[] = [edge("S", "IMG", true)];
    expect(incomingScriptUpstreamState(nodes, edges, "IMG")).toBe("disabled_only");
  });

  it("orderedIncomingTextNodeIds filters disabled incoming edges", () => {
    const text1 = node("T1", "textNode", 10);
    const text2 = node("T2", "textNode", 20);
    const script = node("S", "scriptNode", 30);
    const nodes = [text1, text2, script];
    const edges: Edge[] = [edge("T1", "S"), edge("T2", "S", true)];
    expect(orderedIncomingTextNodeIds(nodes, edges, "S")).toEqual(["T1"]);
  });

  it("buildScriptPromptFromUpstreamText merges enabled upstream text", () => {
    const text = node("T1", "textNode", 10);
    text.data = { prompt: "上游梗概" };
    const script = node("S", "scriptNode", 20);
    const nodes = [text, script];
    const edges: Edge[] = [edge("T1", "S")];
    expect(buildScriptPromptFromUpstreamText(nodes, edges, "S")).toBe("上游梗概");
    expect(incomingTextUpstreamState(nodes, edges, "S")).toBe("enabled");
  });

  it("incomingScriptUpstreamState returns enabled when at least one enabled script edge exists", () => {
    const script = node("S", "scriptNode", 10);
    const target = node("VID", "videoNode", 30);
    const nodes = [script, target];
    const edges: Edge[] = [edge("S", "VID", true), edge("S", "VID", false)];
    expect(incomingScriptUpstreamState(nodes, edges, "VID")).toBe("enabled");
  });

  it("incomingScriptUpstreamState returns none when no script upstream exists", () => {
    const image = node("IMG", "imageNode", 10);
    const target = node("AUD", "audioNode", 30);
    const nodes = [image, target];
    const edges: Edge[] = [edge("IMG", "AUD")];
    expect(incomingScriptUpstreamState(nodes, edges, "AUD")).toBe("none");
  });

  it("script upstream message helpers return consistent texts", () => {
    expect(scriptSyncButtonTitle("disabled_only", "normal")).toContain("未检测到有效上游");
    expect(scriptSyncButtonTitle("enabled", "normal")).toBe("normal");
    expect(scriptSyncDisabledOnlyStatus("从脚本同步")).toContain("无法从脚本同步");
    expect(inspectorScriptUpstreamHint("none")).toContain("未检测到上游脚本连线");
    expect(inspectorScriptUpstreamHint("enabled")).toContain("已检测到有效上游脚本连线");
  });

  it("getIncomingImageRefForNode ignores disabled image edge", () => {
    const imgEnabled = { ...node("I1", "imageNode"), data: { path: "a.png" } as FlowNodeData };
    const imgDisabled = { ...node("I2", "imageNode"), data: { path: "b.png" } as FlowNodeData };
    const target = node("V1", "videoNode");
    const nodes = [imgEnabled, imgDisabled, target];
    const edges: Edge[] = [edge("I2", "V1", true), edge("I1", "V1")];
    const ref = getIncomingImageRefForNode(nodes, edges, "V1");
    expect(ref.path).toBe("a.png");
  });

  it("computeNextLeftInputY ignores disabled incoming media edges", () => {
    const video = node("V", "videoNode", 100);
    const enabledImage = { ...node("I1", "imageNode", 100), measured: { width: 200, height: 220 } };
    const disabledImage = { ...node("I2", "imageNode", 400), measured: { width: 200, height: 220 } };
    const nodes = [video, enabledImage, disabledImage] as Node<FlowNodeData>[];
    const edges: Edge[] = [edge("I1", "V"), edge("I2", "V", true)];
    const nextY = computeNextLeftInputY(nodes, edges, "V", 100);
    expect(nextY).toBe(344);
  });
});

