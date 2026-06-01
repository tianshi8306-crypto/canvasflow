import { describe, expect, it } from "vitest";
import type { HermesDirectorPlan } from "@/lib/hermes/hermesDirectorTypes";
import { formatExperienceFact } from "@/lib/hermes/agent/hermesJobReflection";
import {
  adaptDirectorPlanWithLearnedProcedures,
  adaptDirectorPlanWithLearnedRecoveries,
  createDirectorPlanFromLearnedProcedure,
  formatRecoveryExperiencesForPrompt,
  formatTopLearnedProceduresForPrompt,
  listAvoidSuggestionIds,
  parseLearnedProcedures,
  parseLearnedRecoveries,
  pickBestLearnedProcedure,
  pickBestLearnedRecovery,
  parseReflectionProcedureHints,
  scoreLearnedProcedureMatch,
} from "@/lib/hermes/agent/hermesLearningAdaptation";
import type { HermesPersistentMemory } from "@/lib/hermes/agent/hermesPersistentMemory";

function memoryWithFacts(...texts: string[]): HermesPersistentMemory {
  const now = new Date().toISOString();
  return {
    version: 1,
    userProfile: "",
    updatedAt: now,
    facts: texts.map((text, i) => ({
      id: `f${i}`,
      text,
      source: "agent" as const,
      createdAt: now,
    })),
  };
}

describe("hermesLearningAdaptation", () => {
  it("parses procedure facts from memory", () => {
    const proc = [
      { id: "s1", toolId: "script.generate_storyboard" as const, label: "分镜" },
      { id: "s2", toolId: "image.generate_for_beats" as const, label: "出图" },
    ];
    const plan = {
      id: "p1",
      title: "t",
      sourceMessage: "帮我把分镜出图",
      steps: proc,
    };
    const fact = formatExperienceFact(plan, proc);
    const parsed = parseLearnedProcedures(memoryWithFacts(fact));
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.toolIds).toEqual([
      "script.generate_storyboard",
      "image.generate_for_beats",
    ]);
  });

  it("scores procedure match from user message", () => {
    const memory = memoryWithFacts(
      "[proc:script.generate_storyboard>image.generate_for_beats] 本工程已成功：帮我把分镜出图（顺序：生成分镜 → 批量出图）",
    );
    const proc = parseLearnedProcedures(memory)[0]!;
    expect(scoreLearnedProcedureMatch("帮我把分镜出图", proc, memory)).toBeGreaterThanOrEqual(
      4,
    );
    expect(pickBestLearnedProcedure(memory, "帮我把分镜出图")).not.toBeNull();
  });

  it("boosts procedure score when reflect-proc hint exists", () => {
    const procKey = "script.generate_storyboard>image.generate_for_beats";
    const memory = memoryWithFacts(
      `[proc:${procKey}] 本工程已成功：出图（顺序：分镜 → 出图）`,
      `[reflect-proc:${procKey}] 先确认分镜文案再批量出图，避免跳步`,
    );
    const proc = parseLearnedProcedures(memory)[0]!;
    const base = scoreLearnedProcedureMatch("出图", proc);
    const boosted = scoreLearnedProcedureMatch("出图", proc, memory);
    expect(boosted).toBeGreaterThan(base);
    expect(parseReflectionProcedureHints(memory).get(procKey)?.[0]).toContain("分镜");
  });

  it("replaces weak catalog plan with learned procedure", () => {
    const memory = memoryWithFacts(
      "[proc:script.generate_storyboard>image.generate_for_beats] 本工程已成功：出图（顺序：分镜 → 出图）",
    );
    const weak: HermesDirectorPlan = {
      id: "w",
      title: "弱",
      sourceMessage: "帮我把分镜出图",
      steps: [
        {
          id: "s0",
          toolId: "canvas.summarize",
          label: "请先打开工程",
          args: { catalogOnly: true },
        },
      ],
    };
    const adapted = adaptDirectorPlanWithLearnedProcedures(
      weak,
      memory,
      "帮我把分镜出图",
    );
    expect(adapted?.plannerSource).toBe("learned");
    expect(adapted?.steps.map((s) => s.toolId)).toEqual([
      "script.generate_storyboard",
      "image.generate_for_beats",
    ]);
  });

  it("extends plan with learned tail steps", () => {
    const memory = memoryWithFacts(
      "[proc:script.generate_storyboard>image.generate_for_beats>video.generate_for_beats] 本工程已成功：全流程（顺序：分镜 → 出图 → 视频）",
    );
    const partial: HermesDirectorPlan = {
      id: "p",
      title: "部分",
      sourceMessage: "帮我把分镜出图再出视频",
      steps: [
        { id: "a", toolId: "script.generate_storyboard", label: "分镜" },
        { id: "b", toolId: "image.generate_for_beats", label: "出图" },
      ],
    };
    const adapted = adaptDirectorPlanWithLearnedProcedures(
      partial,
      memory,
      "帮我把分镜出图再出视频",
    );
    expect(adapted?.steps.map((s) => s.toolId)).toContain("video.generate_for_beats");
  });

  it("listAvoidSuggestionIds reads avoid facts", () => {
    const memory = memoryWithFacts(
      "[avoid:optimize_shot_count] 当前 20 镜，短剧节奏可能偏密",
    );
    expect(listAvoidSuggestionIds(memory).has("optimize_shot_count")).toBe(true);
  });

  it("createDirectorPlanFromLearnedProcedure sets learned source", () => {
    const proc = parseLearnedProcedures(
      memoryWithFacts(
        "[proc:image.generate_for_beats>video.generate_for_beats] 本工程已成功：出视频（顺序：出图 → 视频）",
      ),
    )[0]!;
    const plan = createDirectorPlanFromLearnedProcedure(proc, "批量出视频");
    expect(plan.plannerSource).toBe("learned");
    expect(plan.steps.length).toBe(2);
  });

  it("parses recover facts and boosts retry planning", () => {
    const recoverFact =
      "[recover:video_failed] 本工程灵体主动恢复已成功：帮我把失败镜头的视频重新生成（video.retry_failed）";
    const memory = memoryWithFacts(recoverFact);
    const parsed = parseLearnedRecoveries(memory);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.toolIds).toEqual(["video.retry_failed"]);
    expect(pickBestLearnedRecovery(memory, "帮我把失败镜头的视频重新生成")).not.toBeNull();

    const block = formatRecoveryExperiencesForPrompt(
      memory,
      "重试失败视频",
    );
    expect(block).toContain("恢复成功经验");
    expect(block).toContain("video_failed");

    const top = formatTopLearnedProceduresForPrompt(memory, "重试失败视频");
    expect(top).toContain("恢复成功经验");

    const adapted = adaptDirectorPlanWithLearnedRecoveries(
      null,
      memory,
      "帮我把失败镜头的视频重新生成",
    );
    expect(adapted?.steps[0]?.toolId).toBe("video.retry_failed");
    expect(adapted?.plannerSource).toBe("learned");
  });
});
