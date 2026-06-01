import { describe, expect, it } from "vitest";
import type { HermesPlanStep } from "@/lib/hermes/hermesDirectorTypes";
import {
  formatHermesSelectionAckLine,
  resolveStepHighlightNodeIds,
} from "@/lib/hermes/hermesCanvasHighlight";
import { SCRIPT_BEAT_EMPTY_FIELDS } from "@/lib/scriptBeatHelpers";
import type { FlowNodeData, ScriptBeat } from "@/lib/types";
import type { Node } from "@xyflow/react";

function makeBeat(id: string, shotNumber: string): ScriptBeat {
  return { ...SCRIPT_BEAT_EMPTY_FIELDS, id, shotNumber };
}

function scriptNode(id: string, beats: ScriptBeat[]): Node<FlowNodeData> {
  return {
    id,
    type: "scriptNode",
    position: { x: 0, y: 0 },
    data: { scriptBeats: beats } as FlowNodeData,
  };
}

function videoNode(id: string, beatId: string, _scriptId: string): Node<FlowNodeData> {
  return {
    id,
    type: "videoNode",
    position: { x: 100, y: 0 },
    data: {
      params: { scriptBeatId: beatId },
    } as FlowNodeData,
  };
}

describe("hermesCanvasHighlight", () => {
  it("resolveStepHighlightNodeIds picks media node for beat", () => {
    const scriptId = "script-1";
    const beatId = "beat-2";
    const videoId = "vid-2";
    const nodes = [
      scriptNode(scriptId, [makeBeat("beat-1", "1"), makeBeat(beatId, "2")]),
      videoNode(videoId, beatId, scriptId),
    ];
    const step: HermesPlanStep = {
      id: "s1",
      toolId: "canvas.focus",
      label: "定位第 2 镜",
      args: { beatIds: [2] },
    };
    const ids = resolveStepHighlightNodeIds(step, {
      sourceMessage: "定位第 2 镜",
      scriptNodeId: scriptId,
      nodes,
      edges: [{ id: "e1", source: scriptId, target: videoId }],
    });
    expect(ids).toContain(videoId);
  });

  it("formatHermesSelectionAckLine for single node", () => {
    const line = formatHermesSelectionAckLine(
      [
        {
          id: "n1",
          type: "videoNode",
          position: { x: 0, y: 0 },
          data: { prompt: "霓虹雨夜" } as FlowNodeData,
        },
      ],
      ["n1"],
    );
    expect(line).toContain("已注意到选中");
    expect(line).toContain("霓虹雨夜");
  });
});
