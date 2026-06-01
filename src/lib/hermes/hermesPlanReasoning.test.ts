import { describe, expect, it } from "vitest";
import type { HermesDirectorPlan } from "@/lib/hermes/hermesDirectorTypes";
import { completePlanWithLogicalSteps } from "@/lib/hermes/hermesPlanReasoning";
import type { FlowNodeData } from "@/lib/types";
import type { Node } from "@xyflow/react";

const nodes: Node<FlowNodeData>[] = [
  {
    id: "s1",
    type: "scriptNode",
    position: { x: 0, y: 0 },
    data: {
      label: "脚本",
      scriptBeats: [
        { id: "b1", shotNumber: "1", description: "a" },
        { id: "b2", shotNumber: "2", description: "b" },
      ] as FlowNodeData["scriptBeats"],
      storyboardShots: [
        { scriptBeatId: "b1", status: "generated", visualPrompt: "x" },
      ],
    },
  },
];

describe("hermesPlanReasoning", () => {
  it("inserts storyboard before video when storyboard missing", () => {
    const plan: HermesDirectorPlan = {
      id: "p1",
      title: "出视频",
      sourceMessage: "出视频",
      steps: [
        { id: "v1", toolId: "video.generate_for_beats", label: "批量出视频" },
      ],
    };
    const reasoned = completePlanWithLogicalSteps(plan, nodes, [], "/proj", null);
    expect(reasoned.steps[0]?.toolId).toBe("script.generate_storyboard");
    expect(reasoned.steps.some((s) => s.toolId === "video.generate_for_beats")).toBe(
      true,
    );
  });

  it("inserts workflow_check before export when not ready", () => {
    const plan: HermesDirectorPlan = {
      id: "p2",
      title: "导出",
      sourceMessage: "导出",
      steps: [{ id: "e1", toolId: "compose.export_script", label: "导出" }],
    };
    const reasoned = completePlanWithLogicalSteps(plan, nodes, [], "/proj", null);
    expect(reasoned.steps[0]?.toolId).toBe("film.workflow_check");
  });
});
