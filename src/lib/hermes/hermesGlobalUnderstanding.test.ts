import { describe, expect, it } from "vitest";
import { buildHermesSituation, formatHermesSituationForLlm } from "@/lib/hermes/hermesSituation";
import {
  inferHermesPipelinePhase,
  formatHermesGlobalUnderstandingForLlm,
} from "@/lib/hermes/hermesGlobalUnderstanding";
import type { FlowNodeData } from "@/lib/types";
import type { Node } from "@xyflow/react";

function beat(id: string, shotNumber: string) {
  return { id, shotNumber, description: "a" } as NonNullable<
    FlowNodeData["scriptBeats"]
  >[number];
}

describe("hermesGlobalUnderstanding", () => {
  it("无脚本时为自由编排阶段", () => {
    const phase = inferHermesPipelinePhase(
      {
        beatCount: 0,
        storyboardReady: 0,
        storyboardMissing: 0,
        storyboardFailed: 0,
        imageReady: 0,
        imageMissing: 0,
        videoGenerated: 0,
        videoFailed: 0,
        videoEligible: 0,
        videoMissing: 0,
        exportReady: 0,
        exportTotal: 0,
      },
      "ideation",
      false,
    );
    expect(phase.label).toBe("自由编排");
    expect(phase.recommendedNext).toContain("按需");
  });

  it("infers storyboard phase when beats lack storyboard", () => {
    const phase = inferHermesPipelinePhase(
      {
        beatCount: 4,
        storyboardReady: 1,
        storyboardMissing: 3,
        storyboardFailed: 0,
        imageReady: 0,
        imageMissing: 0,
        videoGenerated: 0,
        videoFailed: 0,
        videoEligible: 0,
        videoMissing: 0,
        exportReady: 0,
        exportTotal: 0,
      },
      "visualization",
      true,
    );
    expect(phase.id).toBe("storyboard");
    expect(phase.progressPct).toBeGreaterThan(0);
    expect(phase.bottleneck).toContain("分镜");
  });

  it("format block includes pipeline and recommendation", () => {
    const nodes: Node<FlowNodeData>[] = [
      {
        id: "s1",
        type: "scriptNode",
        position: { x: 0, y: 0 },
        data: {
          label: "脚本",
          scriptBeats: [beat("b1", "1")],
          storyboardShots: [
            { scriptBeatId: "b1", status: "generated", visualPrompt: "x" },
          ],
        },
      },
    ];
    const situation = buildHermesSituation(nodes, [], "/proj");
    const block = formatHermesGlobalUnderstandingForLlm(situation);
    expect(block).toContain("【全片理解】");
    expect(block).toContain("建议下一步");
  });

  it("formatHermesSituationForLlm embeds global understanding", () => {
    const nodes: Node<FlowNodeData>[] = [
      {
        id: "s1",
        type: "scriptNode",
        position: { x: 0, y: 0 },
        data: {
          label: "脚本",
          scriptBeats: [beat("b1", "1")],
          storyboardShots: [
            { scriptBeatId: "b1", status: "generated", visualPrompt: "x" },
          ],
        },
      },
    ];
    const text = formatHermesSituationForLlm(buildHermesSituation(nodes, [], "/proj"));
    expect(text).toContain("【全片理解】");
    expect(text).toContain("制片专家");
  });
});
