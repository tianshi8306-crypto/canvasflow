import { describe, expect, it } from "vitest";
import {
  filterGapsForSituationCard,
  isGapProactiveEligible,
  isGapSituationCardVisible,
  isProactiveSuggestionEligible,
  shouldAutoActOrbSuggestion,
  shouldEnhanceOrbSuggestionWithLlm,
  shouldSuggestWorkflowAutoRepair,
} from "@/lib/hermes/hermesProactivePolicy";

describe("hermesProactivePolicy", () => {
  it("排除线性流程催促类缺口", () => {
    expect(isGapProactiveEligible("storyboard_missing")).toBe(true);
    expect(isGapProactiveEligible("storyboard_failed")).toBe(true);
    expect(isGapProactiveEligible("image_missing")).toBe(false);
    expect(isGapProactiveEligible("video_ready_batch")).toBe(false);
    expect(isGapProactiveEligible("no_beats")).toBe(false);
  });

  it("排除顾问向稳态建议", () => {
    expect(isProactiveSuggestionEligible("storyboard_complete_chain")).toBe(true);
    expect(isProactiveSuggestionEligible("optimize_shot_count")).toBe(false);
    expect(isProactiveSuggestionEligible("video_eligible")).toBe(false);
  });

  it("流程修复仅在真实断链时触发", () => {
    expect(shouldSuggestWorkflowAutoRepair(["empty_beats"])).toBe(false);
    expect(shouldSuggestWorkflowAutoRepair(["video_stalled"])).toBe(false);
    expect(shouldSuggestWorkflowAutoRepair(["video_failed_batch"])).toBe(true);
  });

  it("LLM 增强仅高价值场景", () => {
    expect(shouldEnhanceOrbSuggestionWithLlm("video_failed")).toBe(true);
    expect(shouldEnhanceOrbSuggestionWithLlm("gap_video_failed")).toBe(true);
    expect(shouldEnhanceOrbSuggestionWithLlm("storyboard_complete_chain")).toBe(true);
    expect(shouldEnhanceOrbSuggestionWithLlm("optimize_shot_count")).toBe(false);
    expect(shouldEnhanceOrbSuggestionWithLlm("gap_image_missing")).toBe(false);
  });

  it("侧栏 Situation 卡过滤稳态缺口", () => {
    expect(isGapSituationCardVisible("image_missing")).toBe(false);
    expect(isGapSituationCardVisible("production_empty_beats")).toBe(false);
    expect(isGapSituationCardVisible("video_failed")).toBe(true);
    expect(isGapSituationCardVisible("production_video_failed_batch")).toBe(true);
    const filtered = filterGapsForSituationCard([
      { id: "image_missing" },
      { id: "video_failed" },
      { id: "production_export_not_ready_yet" },
    ]);
    expect(filtered.map((g) => g.id)).toEqual(["video_failed"]);
  });

  it("灵体自动执行仅恢复类 id", () => {
    expect(shouldAutoActOrbSuggestion("video_failed")).toBe(true);
    expect(shouldAutoActOrbSuggestion("pipeline_checkpoint_resume")).toBe(true);
    expect(shouldAutoActOrbSuggestion("images_ready_video")).toBe(false);
    expect(shouldAutoActOrbSuggestion("gap_storyboard_missing")).toBe(false);
  });
});
