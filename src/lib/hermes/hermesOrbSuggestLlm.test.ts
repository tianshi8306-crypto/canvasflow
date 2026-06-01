import { describe, expect, it } from "vitest";
import {
  mergeOrbLlmEnhancement,
  parseOrbSuggestLlmPayload,
} from "@/lib/hermes/hermesOrbSuggestLlm";
import type { HermesOrbSuggestion } from "@/lib/hermes/hermesOrbSuggestions.types";

const base: HermesOrbSuggestion = {
  id: "video_failed",
  severity: "warn",
  message: "规则文案",
  actionLabel: "重试",
  actionPrompt: "重试失败视频",
};

describe("hermesOrbSuggestLlm", () => {
  it("parseOrbSuggestLlmPayload 支持围栏 JSON", () => {
    const raw = '```json\n{"message":"镜3 视频失败","actionLabel":"重试镜3"}\n```';
    expect(parseOrbSuggestLlmPayload(raw)).toEqual({
      message: "镜3 视频失败",
      actionLabel: "重试镜3",
    });
  });

  it("mergeOrbLlmEnhancement 保留 id/severity 并合并文案", () => {
    const merged = mergeOrbLlmEnhancement(base, {
      message: "第 3 镜 Seedance 失败，可只重试这一镜",
      actionLabel: "重试镜3",
      actionPrompt: "仅重试镜号 3 的失败视频",
    });
    expect(merged.id).toBe("video_failed");
    expect(merged.severity).toBe("warn");
    expect(merged.message).toContain("第 3 镜");
    expect(merged.actionLabel).toBe("重试镜3");
  });

  it("mergeOrbLlmEnhancement 空 payload 回退规则", () => {
    expect(mergeOrbLlmEnhancement(base, null)).toEqual(base);
    expect(mergeOrbLlmEnhancement(base, {})).toEqual(base);
  });

  it("mergeOrbLlmEnhancement 过长字段回退", () => {
    const merged = mergeOrbLlmEnhancement(base, {
      message: "x".repeat(100),
      actionLabel: "y".repeat(20),
    });
    expect(merged.message).toBe(base.message);
    expect(merged.actionLabel).toBe(base.actionLabel);
  });
});
