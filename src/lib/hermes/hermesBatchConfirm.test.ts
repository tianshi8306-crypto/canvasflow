import { beforeEach, describe, expect, it } from "vitest";
import {
  formatBatchConfirmPrompt,
  isBatchCancelReply,
  isBatchConfirmReply,
  planNeedsBatchConfirmation,
  shouldSkipBatchConfirmation,
} from "@/lib/hermes/hermesBatchConfirm";
import {
  setHermesAgentSettingsCacheForTest,
  defaultHermesAgentSettings,
} from "@/lib/hermes/agent/hermesAgentSettings";
import type { HermesDirectorPlan } from "@/lib/hermes/hermesDirectorTypes";

describe("hermesBatchConfirm", () => {
  beforeEach(() => {
    setHermesAgentSettingsCacheForTest({
      ...defaultHermesAgentSettings(),
      agentAutoBatch: false,
    });
  });

  const ctx = {
    projectPath: "/p",
    scriptNodeId: "s1",
    beatCount: 8,
    storyboardReadyCount: 8,
    hasBrief: true,
    beatIds: ["b1", "b2"],
  };

  it("requires confirmation for large batch video", () => {
    const plan: HermesDirectorPlan = {
      id: "1",
      title: "t",
      sourceMessage: "出视频",
      steps: [
        {
          id: "a",
          toolId: "video.generate_for_beats",
          label: "批量出视频",
        },
      ],
    };
    const r = planNeedsBatchConfirmation(plan, ctx);
    expect(r.needed).toBe(true);
    expect(r.beatCount).toBe(8);
  });

  it("parses confirm and cancel replies", () => {
    expect(isBatchConfirmReply("继续")).toBe(true);
    expect(isBatchCancelReply("取消")).toBe(true);
    expect(isBatchConfirmReply("帮我出图")).toBe(false);
  });

  it("full-auto plan skips confirm even when pref off", () => {
    const plan: HermesDirectorPlan = {
      id: "2",
      title: "t",
      sourceMessage: "全自动",
      templateId: "full-auto-export",
      steps: [{ id: "b", toolId: "image.generate_for_beats", label: "出图" }],
    };
    expect(shouldSkipBatchConfirmation(plan)).toBe(true);
  });

  it("formats batch confirm prompt", () => {
    const msg = formatBatchConfirmPrompt(5, ["批量出图"]);
    expect(msg).toContain("5");
    expect(msg).toContain("继续");
  });
});
