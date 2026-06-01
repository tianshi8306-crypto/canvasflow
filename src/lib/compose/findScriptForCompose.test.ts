import { describe, it, expect } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData, ScriptBeat } from "@/lib/types";
import { findScriptNodeForCompose } from "./findScriptForCompose";

function n(id: string, type: string, data: Partial<FlowNodeData> = {}): Node<FlowNodeData> {
  return { id, type, position: { x: 0, y: 0 }, data: data as FlowNodeData };
}

const beat = (id: string): ScriptBeat =>
  ({
    id,
    shotNumber: "1",
    scene: "",
    durationHint: "",
    description: "",
    character1: "",
    character1Desc: "",
    character1Image: "",
    character2: "",
    character2Desc: "",
    character2Image: "",
    reference: "",
    shotSize: "",
    characterAction: "",
    emotion: "",
    sceneTags: "",
    lightingMood: "",
    soundEffect: "",
    dialogue: "",
    storyboardPrompt: "",
    videoMotionPrompt: "",
  }) as ScriptBeat;

describe("findScriptNodeForCompose", () => {
  it("finds script via script->video->concat edges", () => {
    const nodes = [
      n("s1", "scriptNode", { scriptBeats: [beat("b1")] }),
      n("v1", "videoNode", { params: { scriptBeatId: "b1" } }),
      n("c1", "ffmpegConcat", {}),
    ];
    const edges: Edge[] = [
      { id: "e1", source: "s1", target: "v1" },
      { id: "e2", source: "v1", target: "c1" },
    ];
    expect(findScriptNodeForCompose("c1", nodes, edges)).toBe("s1");
  });

  it("returns null when no script link", () => {
    const nodes = [n("v1", "videoNode", {}), n("c1", "ffmpegConcat", {})];
    const edges: Edge[] = [{ id: "e1", source: "v1", target: "c1" }];
    expect(findScriptNodeForCompose("c1", nodes, edges)).toBeNull();
  });
});
