import { invoke, isTauri } from "@tauri-apps/api/core";
import type {
  HermesDirectorPlan,
  HermesPlanExecutionState,
  HermesPlanStep,
  HermesStepRunStatus,
  HermesToolId,
} from "@/lib/hermes/hermesDirectorTypes";
import {
  appendHermesMemoryFact,
  appendHermesMemoryFactsIfNew,
  loadHermesPersistentMemory,
  mergeHermesUserProfile,
  type HermesPersistentMemory,
} from "@/lib/hermes/agent/hermesPersistentMemory";
import {
  formatLlmReflectionMemoryFacts,
  runLlmJobReflection,
} from "@/lib/hermes/agent/hermesJobReflectionLlm";
import { HERMES_JOB_CANCELLED_ERROR } from "@/lib/hermes/agent/hermesJobStore";
import { HERMES_USER_SKILLS_DIR } from "@/lib/hermes/agent/hermesSkillRegistry";
import {
  isRecoveryOrientedPlan,
  writeRecoverySuccessMemory,
} from "@/lib/hermes/hermesProactiveRecoveryMemory";

const SUBSTANTIVE_TOOLS = new Set<HermesToolId>([
  "script.update_brief",
  "script.generate_outline",
  "script.generate_storyboard",
  "storyboard.patch_shot",
  "bible.update",
  "image.generate_for_beats",
  "image.retry_failed",
  "video.generate_for_beats",
  "video.retry_failed",
  "compose.export_script",
  "film.shot_to_video_prompt",
  "film.batch_set_video_params",
  "film.create_standard_workflow",
  "template.run",
]);

const MEDIA_TOOLS = new Set<HermesToolId>([
  "image.generate_for_beats",
  "image.retry_failed",
  "video.generate_for_beats",
  "video.retry_failed",
]);

export type JobReflectionResult = {
  wroteMemory: boolean;
  wroteSkill: boolean;
  wroteLlmReflection: boolean;
  memoryText?: string;
  skillRelPath?: string;
  llmInsight?: string;
};

export function completedStepsFromState(
  plan: HermesDirectorPlan,
  state: HermesPlanExecutionState,
): HermesPlanStep[] {
  return plan.steps.filter((s) => state.stepStatuses[s.id] === "done");
}

export function buildProcedureKey(steps: HermesPlanStep[]): string {
  return steps.map((s) => s.toolId).join(">");
}

export function isSubstantiveProcedure(steps: HermesPlanStep[]): boolean {
  const substantive = steps.filter((s) => SUBSTANTIVE_TOOLS.has(s.toolId));
  return substantive.length >= 2;
}

export function shouldWriteAutoSkill(steps: HermesPlanStep[]): boolean {
  if (steps.length < 2) return false;
  const hasMedia = steps.some((s) => MEDIA_TOOLS.has(s.toolId));
  return hasMedia && isSubstantiveProcedure(steps);
}

export function formatExperienceFact(
  plan: HermesDirectorPlan,
  completed: HermesPlanStep[],
): string {
  const key = buildProcedureKey(completed);
  const stepLabels = completed.map((s) => s.label).join(" → ");
  const trigger = plan.sourceMessage.trim().slice(0, 80) || plan.title.trim();
  return `[proc:${key}] 本工程已成功：${trigger}（顺序：${stepLabels}）`;
}

export function formatFailureFact(
  failedStep: HermesPlanStep | null,
  error: string,
): string | null {
  if (!failedStep || !error.trim()) return null;
  return `[fail:${failedStep.toolId}] 步骤「${failedStep.label}」失败：${error.trim().slice(0, 200)}`;
}

export function hasProcedureMemory(
  memory: HermesPersistentMemory,
  procedureKey: string,
): boolean {
  const prefix = `[proc:${procedureKey}]`;
  return memory.facts.some((f) => f.text.startsWith(prefix));
}

function slugifySkillId(procedureKey: string): string {
  return procedureKey.replace(/>/g, "-").replace(/[^a-z0-9-]/gi, "-").slice(0, 48);
}

function buildAutoSkillMarkdown(
  plan: HermesDirectorPlan,
  completed: HermesPlanStep[],
): { id: string; markdown: string } {
  const procedureKey = buildProcedureKey(completed);
  const id = `auto-${slugifySkillId(procedureKey)}`;
  const trigger = plan.sourceMessage.trim().slice(0, 120) || plan.title.trim();
  const lines = completed.map((s, i) => `${i + 1}. ${s.label} (\`${s.toolId}\`)`);
  const markdown = `---
id: ${id}
name: 自动经验 · ${completed[completed.length - 1]?.label ?? "制片"}
description: Hermes 从成功任务自动总结（${trigger.slice(0, 60)}）
---

## 适用场景

用户意图类似：${trigger}

## 推荐步骤顺序

${lines.join("\n")}

> 由 Hermes 在任务成功后自动写入；可在画布审核后再手动调整。
`;
  return { id, markdown };
}

async function writeAutoSkillFile(
  projectPath: string,
  markdown: string,
  skillId: string,
): Promise<string> {
  const relPath = `${HERMES_USER_SKILLS_DIR}/${skillId}.md`;
  await invoke("write_project_rel_text_file", {
    projectPath: projectPath.trim(),
    relPath,
    content: markdown,
  });
  return relPath;
}

export function findFailedStep(
  plan: HermesDirectorPlan,
  state: HermesPlanExecutionState,
): HermesPlanStep | null {
  for (const step of plan.steps) {
    if (state.stepStatuses[step.id] === "failed") return step;
  }
  return null;
}

export async function reflectDirectorPlanJob(
  projectPath: string | null,
  plan: HermesDirectorPlan,
  state: HermesPlanExecutionState,
): Promise<JobReflectionResult> {
  const empty: JobReflectionResult = {
    wroteMemory: false,
    wroteSkill: false,
    wroteLlmReflection: false,
  };
  if (!projectPath?.trim() || !isTauri()) return empty;
  if (state.error === HERMES_JOB_CANCELLED_ERROR) return empty;

  const completed = completedStepsFromState(plan, state);

  if (!state.error && isRecoveryOrientedPlan(plan) && completed.length > 0) {
    const recovery = await writeRecoverySuccessMemory(projectPath, plan, state);
    const result: JobReflectionResult = {
      ...empty,
      wroteMemory: recovery.wrote,
      memoryText: recovery.fact,
    };
    return applyLlmReflectionLayer(projectPath, plan, state, result);
  }

  if (plan.isRecovery) {
    if (state.error) {
      const failedStep = findFailedStep(plan, state);
      const failFact = formatFailureFact(failedStep, state.error);
      if (!failFact) return applyLlmReflectionLayer(projectPath, plan, state, empty);
      const memory = await loadHermesPersistentMemory(projectPath);
      const failPrefix = failFact.slice(0, 32);
      let result: JobReflectionResult = { ...empty };
      if (!memory.facts.some((f) => f.text.startsWith(failPrefix))) {
        await appendHermesMemoryFact(projectPath, failFact, "agent");
        result = { ...result, wroteMemory: true, memoryText: failFact };
      }
      return applyLlmReflectionLayer(projectPath, plan, state, result);
    }
    return empty;
  }

  let result: JobReflectionResult = { ...empty };

  if (state.error) {
    const failedStep = findFailedStep(plan, state);
    const failFact = formatFailureFact(failedStep, state.error);
    if (!failFact) return applyLlmReflectionLayer(projectPath, plan, state, empty);
    const memory = await loadHermesPersistentMemory(projectPath);
    const failPrefix = failFact.slice(0, 32);
    if (!memory.facts.some((f) => f.text.startsWith(failPrefix))) {
      await appendHermesMemoryFact(projectPath, failFact, "agent");
      result = { ...result, wroteMemory: true, memoryText: failFact };
    }
    return applyLlmReflectionLayer(projectPath, plan, state, result);
  }

  if (isSubstantiveProcedure(completed)) {
    const procedureKey = buildProcedureKey(completed);
    const memory = await loadHermesPersistentMemory(projectPath);
    if (!hasProcedureMemory(memory, procedureKey)) {
      const fact = formatExperienceFact(plan, completed);
      await appendHermesMemoryFact(projectPath, fact, "agent");

      let skillRelPath: string | undefined;
      if (shouldWriteAutoSkill(completed)) {
        const { id, markdown } = buildAutoSkillMarkdown(plan, completed);
        skillRelPath = await writeAutoSkillFile(projectPath, markdown, id);
      }

      result = {
        wroteMemory: true,
        wroteSkill: Boolean(skillRelPath),
        wroteLlmReflection: false,
        memoryText: fact,
        skillRelPath,
      };
    }
  }

  return applyLlmReflectionLayer(projectPath, plan, state, result);
}

async function applyLlmReflectionLayer(
  projectPath: string,
  plan: HermesDirectorPlan,
  state: HermesPlanExecutionState,
  base: JobReflectionResult,
): Promise<JobReflectionResult> {
  const parsed = await runLlmJobReflection(plan, state);
  if (!parsed) return base;

  const facts = formatLlmReflectionMemoryFacts(parsed);
  const completed = completedStepsFromState(plan, state);
  if (parsed.lesson?.trim() && completed.length >= 1 && !state.error) {
    const procedureKey = buildProcedureKey(completed);
    facts.push(`[reflect-proc:${procedureKey}] ${parsed.lesson.trim()}`);
  }

  let wroteMemory = base.wroteMemory;
  if (facts.length > 0) {
    const added = await appendHermesMemoryFactsIfNew(projectPath, facts, "agent");
    if (added > 0) wroteMemory = true;
  }

  const llmInsight = [parsed.lesson, parsed.avoid].filter(Boolean).join("；") || undefined;
  if (parsed.profile?.trim()) {
    await mergeHermesUserProfile(projectPath, parsed.profile.trim());
  }

  return {
    ...base,
    wroteMemory,
    wroteLlmReflection: Boolean(llmInsight || facts.length > 0 || parsed.profile),
    llmInsight,
  };
}

/** 单测：从 stepStatuses 构造 state */
export function executionStateFromStatuses(
  planId: string,
  statuses: Record<string, HermesStepRunStatus>,
  error: string | null = null,
): HermesPlanExecutionState {
  return {
    planId,
    stepStatuses: statuses,
    currentStepId: null,
    error,
  };
}
