import { describe, expect, it } from "vitest";
import type { HermesDirectorPlan } from "@/lib/hermes/hermesDirectorTypes";
import {
  buildJobReflectionUserPrompt,
  formatLlmReflectionMemoryFacts,
  parseLlmJobReflectionResponse,
  shouldRunLlmJobReflection,
} from "@/lib/hermes/agent/hermesJobReflectionLlm";
import { executionStateFromStatuses } from "@/lib/hermes/agent/hermesJobReflection";
import {
  defaultHermesAgentSettings,
  setHermesAgentSettingsCacheForTest,
} from "@/lib/hermes/agent/hermesAgentSettings";

function plan(): HermesDirectorPlan {
  return {
    id: "p1",
    title: "出图",
    sourceMessage: "1-3 镜出图",
    steps: [
      { id: "s1", toolId: "script.generate_storyboard", label: "分镜" },
      { id: "s2", toolId: "image.generate_for_beats", label: "出图" },
    ],
  };
}

describe("hermesJobReflectionLlm", () => {
  it("parses JSON reflection response", () => {
    const raw = `{"lesson":"先补分镜再批量出图","avoid":"不要跳过 storyboard"}`;
    const parsed = parseLlmJobReflectionResponse(raw);
    expect(parsed?.lesson).toContain("分镜");
    expect(parsed?.avoid).toContain("storyboard");
  });

  it("formats memory facts with tags", () => {
    const facts = formatLlmReflectionMemoryFacts({
      lesson: "先分镜",
      avoid: "别跳步",
    });
    expect(facts[0]).toMatch(/^\[reflect\]/);
    expect(facts[1]).toMatch(/^\[avoid:llm_reflect\]/);
  });

  it("buildJobReflectionUserPrompt includes failure", () => {
    const p = plan();
    const state = executionStateFromStatuses(
      p.id,
      { s1: "done", s2: "failed" },
      "API 超时",
    );
    const text = buildJobReflectionUserPrompt(p, state);
    expect(text).toContain("失败");
    expect(text).toContain("出图");
  });

  it("shouldRunLlmJobReflection respects settings", () => {
    setHermesAgentSettingsCacheForTest({
      ...defaultHermesAgentSettings(),
      agentPostJobLlmReflect: false,
    });
    const p = plan();
    const state = executionStateFromStatuses(p.id, { s1: "done", s2: "done" });
    expect(shouldRunLlmJobReflection(p, state)).toBe(false);
    setHermesAgentSettingsCacheForTest(null);
  });
});
