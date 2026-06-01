import { describe, expect, it } from "vitest";
import { shouldSkipBatchConfirmation } from "@/lib/hermes/hermesBatchConfirm";
import { userMessageRequestsFullAuto } from "@/lib/hermes/hermesAutoPipelinePrefs";
import {
  instantiateTemplatePlan,
  HERMES_FULL_AUTO_TEMPLATE_ID,
} from "@/lib/hermes/hermesPlanTemplates";
import {
  planFromPipelineCheckpoint,
  savePipelineCheckpoint,
  loadPipelineCheckpoint,
  clearPipelineCheckpoint,
} from "@/lib/hermes/hermesPipelineCheckpoint";
import { resolveAutoPipelineChatIntent } from "@/lib/hermes/hermesAutoPipelineChat";

describe("hermesAutoPipeline", () => {
  it("detects full auto user message", () => {
    expect(userMessageRequestsFullAuto("全自动跑片，雨夜追逐")).toBe(true);
    expect(userMessageRequestsFullAuto("什么是蒙太奇")).toBe(false);
  });

  it("full-auto template skips batch confirm", () => {
    const plan = instantiateTemplatePlan(HERMES_FULL_AUTO_TEMPLATE_ID, "test");
    expect(plan).not.toBeNull();
    expect(shouldSkipBatchConfirmation(plan!)).toBe(true);
  });

  it("checkpoint slice for resume", () => {
    const projectPath = "/tmp/test-project-auto";
    clearPipelineCheckpoint(projectPath);
    const plan = instantiateTemplatePlan(HERMES_FULL_AUTO_TEMPLATE_ID, "创意");
    expect(plan).not.toBeNull();
    savePipelineCheckpoint(projectPath, { plan: plan!, completedStepCount: 3 });
    const cp = loadPipelineCheckpoint(projectPath);
    expect(cp?.completedStepCount).toBe(3);
    const resumed = planFromPipelineCheckpoint(cp!);
    expect(resumed?.steps.length).toBe(plan!.steps.length - 3);
    clearPipelineCheckpoint(projectPath);
  });

  it("resume chat intent", () => {
    expect(resolveAutoPipelineChatIntent("继续跑片")).toBe("resume_pipeline");
  });
});
