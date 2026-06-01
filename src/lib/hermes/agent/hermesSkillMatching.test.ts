import { describe, expect, it } from "vitest";
import { HERMES_SKILLS } from "@/lib/hermes/hermesSkills";
import { BUILTIN_SKILL_META } from "@/lib/hermes/agent/hermesSkillMetadata";
import {
  rankSkillsForMessage,
  scoreSkillRelevance,
  SKILL_TEMPLATE_OVERRIDE_MIN_SCORE,
} from "@/lib/hermes/agent/hermesSkillMatching";
import type { HermesRegisteredSkill } from "@/lib/hermes/agent/hermesSkillRegistry";
import { applySkillsToDirectorPlan } from "@/lib/hermes/agent/hermesSkillPlan";

function builtinSkill(id: string): HermesRegisteredSkill {
  const base = HERMES_SKILLS.find((s) => s.id === id)!;
  const meta = BUILTIN_SKILL_META[id] ?? {};
  return {
    ...base,
    builtin: true,
    ...meta,
    triggers: meta.triggers,
  };
}

describe("hermesSkillMatching", () => {
  it("scores template triggers higher than unrelated skills", () => {
    const skills = [builtinSkill("tpl-keyframes"), builtinSkill("tts-delivery")];
    const ranked = rankSkillsForMessage("帮我跑分镜出关键帧", skills);
    expect(ranked[0]?.skill.id).toBe("tpl-keyframes");
    expect(ranked[0]!.score).toBeGreaterThanOrEqual(SKILL_TEMPLATE_OVERRIDE_MIN_SCORE);
  });

  it("matches skill id in message", () => {
    const skill = builtinSkill("workflow-check");
    expect(scoreSkillRelevance("workflow-check 一下", skill)).toBeGreaterThan(10);
  });
});

describe("applySkillsToDirectorPlan", () => {
  it("replaces weak summarize plan with skill template", () => {
    const skills = [builtinSkill("tpl-keyframes")];
    const ranked = rankSkillsForMessage("分镜出关键帧", skills);
    const weak = {
      id: "p1",
      title: "弱计划",
      sourceMessage: "分镜出关键帧",
      steps: [
        {
          id: "s1",
          toolId: "canvas.summarize" as const,
          label: "请先打开工程",
          args: { catalogOnly: true },
        },
      ],
      plannerSource: "rules" as const,
    };
    const next = applySkillsToDirectorPlan(weak, "分镜出关键帧", skills, ranked);
    expect(next?.templateId).toBe("storyboard-keyframes");
    expect(next!.steps.length).toBeGreaterThan(1);
  });
});
