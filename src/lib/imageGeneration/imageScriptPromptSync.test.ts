import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData, ScriptBeat, StoryboardShot } from "@/lib/types";
import {
  applyImagePromptFromScript,
  getImageScriptBoundPrompt,
} from "./imageScriptPromptSync";

function scriptNode(
  id: string,
  beats: Partial<ScriptBeat> & { id: string }[],
  shots?: StoryboardShot[],
): Node<FlowNodeData> {
  return {
    id,
    type: "scriptNode",
    position: { x: 0, y: 0 },
    data: {
      label: "脚本",
      scriptBeats: beats as ScriptBeat[],
      storyboardShots: shots,
    },
  };
}

function imageNode(id: string, params?: Record<string, unknown>): Node<FlowNodeData> {
  return {
    id,
    type: "imageNode",
    position: { x: 100, y: 0 },
    data: { label: "图", params },
  };
}

describe("imageScriptPromptSync", () => {
  it("returns bound visual from script beat", () => {
    const beatId = "b1";
    const nodes = [
      scriptNode("s1", [{ id: beatId, description: "beat desc" }], [
        { scriptBeatId: beatId, visualPrompt: "夕阳下的城市天际线" } as StoryboardShot,
      ]),
      imageNode("i1", { scriptBeatId: beatId }),
    ];
    const edges: Edge[] = [{ id: "e1", source: "s1", target: "i1" }];
    expect(getImageScriptBoundPrompt(nodes, edges, "i1")).toBe("夕阳下的城市天际线");
  });

  it("applyImagePromptFromScript fails without binding", () => {
    const nodes = [
      scriptNode("s1", [{ id: "b1", description: "场景" }]),
      imageNode("i1"),
    ];
    const edges: Edge[] = [{ id: "e1", source: "s1", target: "i1" }];
    const r = applyImagePromptFromScript(nodes, edges, "i1", 500);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.statusMessage).toContain("无法从脚本同步");
  });

  it("applyImagePromptFromScript succeeds with binding", () => {
    const beatId = "b1";
    const nodes = [
      scriptNode("s1", [{ id: beatId, description: "森林小径" }]),
      imageNode("i1", { scriptBeatId: beatId }),
    ];
    const edges: Edge[] = [{ id: "e1", source: "s1", target: "i1" }];
    const r = applyImagePromptFromScript(nodes, edges, "i1", 500);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.prompt).toBe("森林小径");
  });
});
