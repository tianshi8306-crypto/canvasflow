import type { HermesRegisteredSkill } from "@/lib/hermes/agent/hermesSkillRegistry";
import type { HermesProductionProjectType } from "@/lib/hermes/hermesProjectProfile";
import { projectTypeBoostForSkill } from "@/lib/hermes/hermesProjectProfile";

export type ScoredHermesSkill = {
  skill: HermesRegisteredSkill;
  score: number;
};

function normalizeForMatch(text: string): string {
  return text.trim().toLowerCase();
}

/** 对用户消息与 Skill 元数据打分（id/label/triggers/example） */
export function scoreSkillRelevance(
  message: string,
  skill: HermesRegisteredSkill,
): number {
  const t = normalizeForMatch(message);
  if (!t) return 0;

  let score = skill.priority ?? 0;

  const id = skill.id.toLowerCase();
  if (t.includes(id)) score += 12;

  const label = skill.label.toLowerCase();
  if (label.length >= 2 && t.includes(label)) score += 10;

  for (const trigger of skill.triggers ?? []) {
    const trig = trigger.trim().toLowerCase();
    if (trig.length >= 2 && t.includes(trig)) score += 6;
  }

  const example = skill.exampleUtterance?.toLowerCase() ?? "";
  if (example.length >= 6) {
    for (const chunk of example.split(/[，,。；\s]+/).filter((c) => c.length >= 4)) {
      if (t.includes(chunk)) {
        score += 4;
        break;
      }
    }
  }

  const hint = skill.hint.toLowerCase();
  if (hint.length >= 4 && t.includes(hint.slice(0, Math.min(hint.length, 8)))) {
    score += 2;
  }

  return score;
}

export function rankSkillsForMessage(
  message: string,
  skills: HermesRegisteredSkill[],
  limit = 3,
  opts?: { projectType?: HermesProductionProjectType },
): ScoredHermesSkill[] {
  const ranked = skills
    .map((skill) => {
      let score = scoreSkillRelevance(message, skill);
      if (opts?.projectType) {
        score += projectTypeBoostForSkill(opts.projectType, skill.id);
        if (skill.projectTypes?.includes(opts.projectType)) score += 6;
      }
      return { skill, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || (b.skill.priority ?? 0) - (a.skill.priority ?? 0));

  return ranked.slice(0, limit);
}

export function resolveSkillIdsForPlanning(
  message: string,
  skills: HermesRegisteredSkill[],
  projectType?: HermesProductionProjectType,
): string[] {
  return rankSkillsForMessage(message, skills, 3, { projectType }).map((r) => r.skill.id);
}

/** 模板类 Skill 需达到此分数才覆盖弱规则计划 */
export const SKILL_TEMPLATE_OVERRIDE_MIN_SCORE = 10;
