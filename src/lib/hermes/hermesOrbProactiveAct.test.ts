import { describe, expect, it, beforeEach } from "vitest";
import {
  canOrbProactiveAutoAct,
  markOrbSuggestionAutoActed,
  wasOrbSuggestionAutoActed,
} from "@/lib/hermes/hermesOrbProactiveAct";
import { setHermesAgentSettingsCacheForTest } from "@/lib/hermes/agent/hermesAgentSettings";
import { defaultHermesAgentSettings } from "@/lib/hermes/agent/hermesAgentSettings";

describe("hermesOrbProactiveAct", () => {
  beforeEach(() => {
    sessionStorage.clear();
    setHermesAgentSettingsCacheForTest({
      ...defaultHermesAgentSettings(),
      agentProactiveRecovery: true,
      agentAutoExecute: true,
    });
  });

  it("allows recovery ids when settings on", () => {
    expect(
      canOrbProactiveAutoAct("video_failed", "/proj", "重试失败视频"),
    ).toBe(true);
    expect(
      canOrbProactiveAutoAct("storyboard_complete_chain", "/proj", "建链"),
    ).toBe(false);
  });

  it("dedupes per session", () => {
    markOrbSuggestionAutoActed("/proj", "video_failed", "重试");
    expect(wasOrbSuggestionAutoActed("/proj", "video_failed", "重试")).toBe(true);
    expect(
      canOrbProactiveAutoAct("video_failed", "/proj", "重试"),
    ).toBe(false);
  });
});
