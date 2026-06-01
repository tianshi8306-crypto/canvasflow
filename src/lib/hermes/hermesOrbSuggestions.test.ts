import { describe, expect, it } from "vitest";
import { buildHermesSituation } from "@/lib/hermes/hermesSituation";
import {
  pickHermesOrbSuggestion,
  productionFingerprint,
} from "@/lib/hermes/hermesOrbSuggestions";
import type { FlowNodeData } from "@/lib/types";
import type { Node } from "@xyflow/react";

function scriptNode(id: string, data: Partial<FlowNodeData> = {}): Node<FlowNodeData> {
  return {
    id,
    type: "scriptNode",
    position: { x: 0, y: 0 },
    data: { label: "脚本", ...data },
  };
}

describe("pickHermesOrbSuggestion", () => {
  it("分镜刚全部就绪时建议建链出图", () => {
    const nodes = [
      scriptNode("s1", {
        scriptBeats: [
          { id: "b1", shotNumber: "1", description: "a" },
        ] as FlowNodeData["scriptBeats"],
        storyboardShots: [
          { scriptBeatId: "b1", status: "generated", visualPrompt: "雨夜街道" },
        ],
      }),
    ];
    const situation = buildHermesSituation(nodes, [], "/proj");
    const prev = productionFingerprint({
      ...situation.production,
      storyboardReady: 0,
      storyboardMissing: 1,
      imageMissing: 1,
    });
    const s = pickHermesOrbSuggestion({
      situation,
      failedTaskCount: 0,
      prevFingerprint: prev,
      dismissedIds: new Set(),
    });
    expect(s?.id).toBe("storyboard_complete_chain");
  });

  it("视频失败优先于缺图提示", () => {
    const nodes = [
      scriptNode("s1", {
        scriptBeats: [{ id: "b1", shotNumber: "1", description: "a" }] as FlowNodeData["scriptBeats"],
        storyboardShots: [
          {
            scriptBeatId: "b1",
            status: "generated",
            visualPrompt: "x",
            videoStatus: "failed",
          },
        ],
      }),
    ];
    const situation = buildHermesSituation(nodes, [], "/proj");
    const s = pickHermesOrbSuggestion({
      situation,
      failedTaskCount: 0,
      prevFingerprint: productionFingerprint(situation.production),
      dismissedIds: new Set(),
    });
    expect(s?.id).toBe("video_failed");
  });

  it("已 dismiss 的 id 不再出现", () => {
    const nodes = [
      scriptNode("s1", {
        scriptBeats: [{ id: "b1", shotNumber: "1", description: "a" }] as FlowNodeData["scriptBeats"],
        storyboardShots: [
          { scriptBeatId: "b1", status: "failed", visualPrompt: "" },
        ],
      }),
    ];
    const situation = buildHermesSituation(nodes, [], "/proj");
    const s = pickHermesOrbSuggestion({
      situation,
      failedTaskCount: 0,
      prevFingerprint: null,
      dismissedIds: new Set([
        "storyboard_failed",
        "gap_storyboard_failed",
        "gap_storyboard_missing",
        "workflow_auto_repair",
      ]),
    });
    expect(s).toBeNull();
  });
});
