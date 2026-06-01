import type { HermesRegisteredSkill } from "@/lib/hermes/agent/hermesSkillRegistry";
import {
  SKILL_TEMPLATE_OVERRIDE_MIN_SCORE,
  type ScoredHermesSkill,
} from "@/lib/hermes/agent/hermesSkillMatching";
import type { HermesDirectorPlan } from "@/lib/hermes/hermesDirectorTypes";
import { instantiateTemplatePlan } from "@/lib/hermes/hermesPlanTemplates";

function isWeakDirectorPlan(plan: HermesDirectorPlan | null): boolean {
  if (!plan) return true;
  if (plan.steps.length !== 1) return false;
  const only = plan.steps[0]!;
  if (only.toolId !== "canvas.summarize") return false;
  return only.label.includes("请先打开") || Boolean(only.args?.catalogOnly);
}

function skillAssumptionLines(
  ranked: ScoredHermesSkill[],
  skills: HermesRegisteredSkill[],
): string[] {
  const byId = new Map(skills.map((s) => [s.id, s]));
  return ranked
    .map((r) => byId.get(r.skill.id))
    .filter((s): s is HermesRegisteredSkill => Boolean(s))
    .map((s) => `Skill「${s.label}」：${s.hint}`);
}

/**
 * 规划收尾：高分 Skill 可套用模板；否则向计划 assumptions 注入 Skill 指引。
 */
export function applySkillsToDirectorPlan(
  plan: HermesDirectorPlan | null,
  userMessage: string,
  skills: HermesRegisteredSkill[],
  ranked: ScoredHermesSkill[],
): HermesDirectorPlan | null {
  if (ranked.length === 0) return plan;

  const top = ranked[0]!;
  const templateId = top.skill.templateId?.trim();
  const canOverrideTemplate =
    Boolean(templateId) &&
    top.score >= SKILL_TEMPLATE_OVERRIDE_MIN_SCORE &&
    (isWeakDirectorPlan(plan) || plan?.plannerSource === "llm");

  if (canOverrideTemplate && templateId) {
    const tplPlan = instantiateTemplatePlan(templateId, userMessage);
    if (tplPlan) {
      const notes = skillAssumptionLines(ranked, skills);
      return {
        ...tplPlan,
        assumptions: [...(tplPlan.assumptions ?? []), ...notes].slice(0, 8),
        plannerSource: "template",
      };
    }
  }

  if (!plan) return plan;

  const notes = skillAssumptionLines(ranked, skills);
  if (notes.length === 0) return plan;

  return {
    ...plan,
    assumptions: [...(plan.assumptions ?? []), ...notes].slice(0, 8),
    plannerSource: plan.plannerSource ?? "reasoned",
  };
}
