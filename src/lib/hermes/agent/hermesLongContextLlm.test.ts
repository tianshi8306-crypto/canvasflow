import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  setHermesAgentSettingsCacheForTest,
  defaultHermesAgentSettings,
} from "@/lib/hermes/agent/hermesAgentSettings";
import {
  shouldLlmSummarizeConversation,
  shouldLlmSummarizeProject,
  summarizeConversationDigestWithLlm,
  summarizeProjectContextWithLlm,
} from "@/lib/hermes/agent/hermesLongContextLlm";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: vi.fn(),
}));

const { invoke } = await import("@tauri-apps/api/core");

describe("hermesLongContextLlm", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    setHermesAgentSettingsCacheForTest(defaultHermesAgentSettings());
  });

  it("shouldLlmSummarizeProject threshold", () => {
    expect(shouldLlmSummarizeProject("短")).toBe(false);
    expect(shouldLlmSummarizeProject("x".repeat(300))).toBe(true);
  });

  it("shouldLlmSummarizeConversation threshold", () => {
    expect(shouldLlmSummarizeConversation(1)).toBe(false);
    expect(shouldLlmSummarizeConversation(2)).toBe(true);
  });

  it("summarizeConversationDigestWithLlm returns trimmed llm output", async () => {
    vi.mocked(invoke).mockResolvedValue("LLM 摘要：用户要竖屏出片\n");
    const out = await summarizeConversationDigestWithLlm({
      olderMessages: [
        { id: "1", role: "user", content: "记住竖屏" },
        { id: "2", role: "assistant", content: "好的" },
      ],
      provider: {
        providerId: "p1",
        model: "m1",
        label: "P",
        providerLabel: "P",
        modelDisplay: "m1",
        dashboardUrl: null,
      },
    });
    expect(out).toContain("LLM 摘要");
    expect(invoke).toHaveBeenCalledWith(
      "llm_complete_text",
      expect.objectContaining({ providerId: "p1" }),
    );
  });

  it("summarizeProjectContextWithLlm returns null on invoke failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("network"));
    const out = await summarizeProjectContextWithLlm({
      ruleBasedDraft: "梗概：雨夜\n" + "x".repeat(400),
      provider: {
        providerId: "p1",
        model: "m1",
        label: "P",
        providerLabel: "P",
        modelDisplay: "m1",
        dashboardUrl: null,
      },
    });
    expect(out).toBeNull();
  });
});
