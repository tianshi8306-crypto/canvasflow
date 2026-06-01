import { describe, expect, it } from "vitest";
import {
  extractNlVisualPrompt,
  parseHermesNlPatchIntent,
  wantsNlPatchShot,
  enrichPatchStepFromMessage,
} from "@/lib/hermes/hermesNlPatch";
import { buildDirectorPlan } from "@/lib/hermes/hermesPlanFromIntent";
import { buildHermesCanvasContext, parseShotNumbersFromMessage } from "@/lib/hermes/hermesCanvasContext";
import type { FlowNodeData } from "@/lib/types";
import type { Node } from "@xyflow/react";

describe("hermesNlPatch", () => {
  it("extractNlVisualPrompt handles 第 N 镜：", () => {
    expect(extractNlVisualPrompt("第 3 镜：赛博朋克雨夜街道")).toBe(
      "赛博朋克雨夜街道",
    );
  });

  it("extractNlVisualPrompt handles 改成 without 把", () => {
    expect(extractNlVisualPrompt("镜2改成古风庭院")).toBe("古风庭院");
  });

  it("parseShotNumbers supports 3号镜", () => {
    expect(parseShotNumbersFromMessage("把3号镜改成夜景")).toEqual([3]);
  });

  it("parse intent includes negative and composition", () => {
    const intent = parseHermesNlPatchIntent(
      "第 1 镜构图改为特写，不要出现文字招牌",
    );
    expect(intent?.shotNumbers).toEqual([1]);
    expect(intent?.compositionNote).toContain("特写");
    expect(intent?.negativePrompt).toContain("文字招牌");
  });

  it("enrichPatchStepFromMessage fills LLM step args", () => {
    const step = enrichPatchStepFromMessage(
      {
        id: "s1",
        toolId: "storyboard.patch_shot",
        label: "改镜",
        args: { beatIds: [2] },
      },
      "把第 2 镜改成雨夜霓虹再出图",
    );
    expect(step.args?.visualPrompt).toBe("雨夜霓虹");
    expect(step.args?.regenerateImage).toBe(true);
  });

  it("wantsNlPatchShot for 重出图 only", () => {
    expect(wantsNlPatchShot("第 1 镜重出图")).toBe(true);
  });
});

describe("buildDirectorPlan nl patch", () => {
  const nodes: Node<FlowNodeData>[] = [
    {
      id: "s1",
      type: "scriptNode",
      position: { x: 0, y: 0 },
      data: {
        label: "脚本",
        scriptBeats: [{ id: "b1", shotNumber: "1", description: "a" }] as FlowNodeData["scriptBeats"],
        storyboardShots: [
          { scriptBeatId: "b1", status: "generated", visualPrompt: "白天" },
        ],
      },
    },
  ];

  it("plans patch for 3号镜", () => {
    const ctx = buildHermesCanvasContext(nodes, "/proj");
    const plan = buildDirectorPlan("3号镜改成夜景再出图", ctx);
    expect(plan?.steps[0]?.toolId).toBe("storyboard.patch_shot");
    expect(plan?.steps[0]?.args?.visualPrompt).toBe("夜景");
    expect(plan?.steps[0]?.args?.regenerateImage).toBe(true);
  });
});
