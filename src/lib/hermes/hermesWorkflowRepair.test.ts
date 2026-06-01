import type { Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import {
  proposeRepairStepsFromProduction,
  proposeRepairStepsFromWorkflowReport,
  wantsWorkflowRepair,
} from "@/lib/hermes/hermesWorkflowRepair";
import { buildHermesCanvasContext } from "@/lib/hermes/hermesCanvasContext";
import type { FilmWorkflowCheckReport } from "@/lib/hermes/film/filmWorkflowCheck";
import { buildDirectorPlan } from "@/lib/hermes/hermesPlanFromIntent";
import type { FlowNodeData } from "@/lib/types";

describe("hermesWorkflowRepair", () => {
  it("wantsWorkflowRepair detects 并修复", () => {
    expect(wantsWorkflowRepair("流程检查并修复")).toBe(true);
    expect(wantsWorkflowRepair("流程检查")).toBe(false);
  });

  it("proposeRepairStepsFromProduction prioritizes video retry", () => {
    const ctx = buildHermesCanvasContext(
      [
        {
          id: "s1",
          type: "scriptNode",
          position: { x: 0, y: 0 },
          data: { label: "脚本" },
        },
      ] as Node<FlowNodeData>[],
      "/proj",
    );
    const steps = proposeRepairStepsFromProduction(
      {
        beatCount: 1,
        storyboardReady: 1,
        storyboardMissing: 0,
        storyboardFailed: 0,
        imageReady: 1,
        imageMissing: 0,
        videoGenerated: 0,
        videoFailed: 2,
        videoEligible: 0,
        videoMissing: 0,
        exportReady: 0,
        exportTotal: 0,
      },
      ctx,
    );
    expect(steps[0]?.toolId).toBe("video.retry_failed");
  });

  it("proposeRepairStepsFromWorkflowReport maps storyboard todo", () => {
    const report: FilmWorkflowCheckReport = {
      stages: [
        {
          id: "storyboard",
          label: "分镜",
          status: "todo",
          detail: "0/3",
          suggestedPrompt: "生成分镜",
        },
      ],
      summary: "待办",
      blockers: 1,
      warnings: 0,
    };
    const steps = proposeRepairStepsFromWorkflowReport(report);
    expect(steps[0]?.toolId).toBe("script.generate_storyboard");
  });

  it("buildDirectorPlan workflow check with autoRepair", () => {
    const nodes: Node<FlowNodeData>[] = [
      {
        id: "s1",
        type: "scriptNode",
        position: { x: 0, y: 0 },
        data: {
          label: "脚本",
          scriptBeats: [{ id: "b1", shotNumber: "1", description: "a" }] as FlowNodeData["scriptBeats"],
        },
      },
    ];
    const ctx = buildHermesCanvasContext(nodes, "/proj");
    const plan = buildDirectorPlan("帮我做流程检查并修复", ctx);
    expect(plan?.steps[0]?.toolId).toBe("film.workflow_check");
    expect(plan?.steps[0]?.args?.autoRepair).toBe(true);
  });
});
