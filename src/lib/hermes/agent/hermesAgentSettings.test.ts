import { describe, expect, it } from "vitest";
import {
  defaultHermesAgentSettings,
  getAgentMaxConcurrentMedia,
  isPlanStepAllowed,
  setHermesAgentSettingsCacheForTest,
  shouldAutoExecutePlans,
  shouldSkipBatchConfirm,
  shouldUseLongContextLlmSummary,
} from "@/lib/hermes/agent/hermesAgentSettings";

describe("hermesAgentSettings", () => {
  it("defaults auto on", () => {
    setHermesAgentSettingsCacheForTest(null);
    expect(shouldAutoExecutePlans()).toBe(true);
    expect(shouldSkipBatchConfirm()).toBe(true);
  });

  it("respects script edit gate", () => {
    setHermesAgentSettingsCacheForTest({
      ...defaultHermesAgentSettings(),
      agentAllowScriptEdit: false,
    });
    const r = isPlanStepAllowed({
      id: "1",
      toolId: "script.update_brief",
      label: "x",
    });
    expect(r.allowed).toBe(false);
  });

  it("long context llm summary toggle", () => {
    setHermesAgentSettingsCacheForTest({
      ...defaultHermesAgentSettings(),
      agentLongContextLlmSummary: false,
    });
    expect(shouldUseLongContextLlmSummary()).toBe(false);
  });

  it("getAgentMaxConcurrentMedia clamps to 1-3", () => {
    setHermesAgentSettingsCacheForTest({
      ...defaultHermesAgentSettings(),
      agentMaxConcurrentMedia: 99,
    });
    expect(getAgentMaxConcurrentMedia()).toBe(3);
    setHermesAgentSettingsCacheForTest({
      ...defaultHermesAgentSettings(),
      agentMaxConcurrentMedia: 0,
    });
    expect(getAgentMaxConcurrentMedia()).toBe(1);
  });
});
