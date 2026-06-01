import type { HermesDirectorPlan, HermesPlanStep, HermesToolId } from "@/lib/hermes/hermesDirectorTypes";
import { buildProcedureKey } from "@/lib/hermes/agent/hermesJobReflection";
import type { HermesPersistentMemory } from "@/lib/hermes/agent/hermesPersistentMemory";
import { appendHermesMemoryFact, loadHermesPersistentMemory } from "@/lib/hermes/agent/hermesPersistentMemory";

const PROC_FACT_RE =
  /^\[proc:([^\]]+)\]\s*本工程已成功：(.+?)（顺序：(.+?)）/;

const AVOID_FACT_RE = /^\[avoid:([^\]]+)\]\s*(.*)$/;

const REFLECT_PROC_RE = /^\[reflect-proc:([^\]]+)\]\s*(.+)$/;

const REFLECT_FACT_RE = /^\[reflect\]\s*(.+)$/;

const RECOVER_FACT_RE =
  /^\[recover:([^\]]+)\]\s*本工程(.+?)已成功：(.+?)（([^)]+)）$/;

const RECOVERY_KEY_HINTS: Record<string, RegExp> = {
  video_failed: /视频.*失败|失败.*视频|重试.*视频/,
  storyboard_failed: /分镜.*失败|失败.*分镜|重试.*分镜/,
  agent_tasks_failed: /任务.*失败|后台.*失败/,
  pipeline_checkpoint_resume: /续跑|断点|checkpoint/i,
  workflow_auto_repair: /流程.*修复|断链|修复.*流程/,
};

const KNOWN_PROCEDURE_TOOLS = new Set<HermesToolId>([
  "canvas.ensure_script",
  "script.update_brief",
  "script.generate_outline",
  "script.generate_storyboard",
  "storyboard.patch_shot",
  "bible.update",
  "chain.spawn_media_nodes",
  "image.generate_for_beats",
  "image.retry_failed",
  "video.generate_for_beats",
  "video.retry_failed",
  "compose.export_script",
  "film.shot_to_video_prompt",
  "film.batch_set_video_params",
  "film.create_standard_workflow",
  "film.workflow_check",
  "template.run",
]);

const TOOL_INTENT_HINTS: Partial<Record<HermesToolId, RegExp>> = {
  "script.generate_storyboard": /分镜|镜头文案/,
  "image.generate_for_beats": /出图|关键帧|配图/,
  "image.retry_failed": /重试|失败.*(关键帧|出图|分镜图)/,
  "video.generate_for_beats": /出视频|成片|视频/,
  "video.retry_failed": /重试|失败.*视频/,
  "compose.export_script": /导出|时间线|合成/,
  "chain.spawn_media_nodes": /建链|节点/,
  "script.generate_outline": /镜头表|大纲/,
};

const TOOL_STEP_LABELS: Partial<Record<HermesToolId, string>> = {
  "canvas.ensure_script": "创建脚本节点",
  "script.update_brief": "写入创意梗概",
  "script.generate_outline": "生成镜头大纲",
  "script.generate_storyboard": "生成分镜文案",
  "storyboard.patch_shot": "修改分镜镜头",
  "bible.update": "更新角色圣经",
  "chain.spawn_media_nodes": "创建图片/视频节点",
  "image.generate_for_beats": "批量提交关键帧出图",
  "image.retry_failed": "重试失败关键帧",
  "video.generate_for_beats": "批量提交视频生成",
  "video.retry_failed": "重试失败视频",
  "compose.export_script": "合成时间线并导出成片",
  "film.shot_to_video_prompt": "写入视频提示词",
  "film.batch_set_video_params": "批量设置视频参数",
  "film.create_standard_workflow": "创建标准工作流",
  "film.workflow_check": "检查生产流程",
  "template.run": "执行计划模板",
};

export type LearnedProcedure = {
  procedureKey: string;
  toolIds: HermesToolId[];
  trigger: string;
  stepLabels: string;
};

export type LearnedRecovery = {
  memoryKey: string;
  via: string;
  trigger: string;
  toolsLine: string;
  toolIds: HermesToolId[];
};

export function parseLearnedRecoveries(memory: HermesPersistentMemory): LearnedRecovery[] {
  const out: LearnedRecovery[] = [];
  for (const fact of memory.facts) {
    const m = fact.text.match(RECOVER_FACT_RE);
    if (!m?.[1] || !m[3] || !m[4]) continue;
    const toolIds = m[4]
      .split(">")
      .map((id) => id.trim())
      .filter((id): id is HermesToolId => KNOWN_PROCEDURE_TOOLS.has(id as HermesToolId));
    if (toolIds.length === 0) continue;
    out.push({
      memoryKey: m[1].trim(),
      via: m[2]!.trim(),
      trigger: m[3].trim(),
      toolsLine: m[4].trim(),
      toolIds,
    });
  }
  return out;
}

export function parseLearnedProcedures(memory: HermesPersistentMemory): LearnedProcedure[] {
  const out: LearnedProcedure[] = [];
  for (const fact of memory.facts) {
    const m = fact.text.match(PROC_FACT_RE);
    if (!m) continue;
    const procedureKey = m[1]!.trim();
    const toolIds = procedureKey
      .split(">")
      .map((id) => id.trim())
      .filter((id): id is HermesToolId => KNOWN_PROCEDURE_TOOLS.has(id as HermesToolId));
    if (toolIds.length < 2) continue;
    out.push({
      procedureKey,
      toolIds,
      trigger: m[2]!.trim(),
      stepLabels: m[3]!.trim(),
    });
  }
  return out;
}

/** LLM 复盘绑定到某条成功路径的加权提示 */
export function parseReflectionProcedureHints(
  memory: HermesPersistentMemory,
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const fact of memory.facts) {
    const m = fact.text.match(REFLECT_PROC_RE);
    if (!m?.[1] || !m[2]) continue;
    const key = m[1].trim();
    const lesson = m[2].trim();
    const list = map.get(key) ?? [];
    list.push(lesson);
    map.set(key, list);
  }
  return map;
}

export function reflectionLessonsForMessage(
  memory: HermesPersistentMemory,
  userMessage: string,
): string[] {
  const tokens = tokenize(userMessage);
  const out: string[] = [];
  for (const fact of memory.facts) {
    const m = fact.text.match(REFLECT_FACT_RE);
    if (!m?.[1]) continue;
    const lesson = m[1].trim();
    const lower = lesson.toLowerCase();
    if (tokens.some((t) => lower.includes(t))) {
      out.push(lesson);
    }
  }
  return out.slice(0, 3);
}

export function listAvoidSuggestionIds(memory: HermesPersistentMemory): Set<string> {
  const ids = new Set<string>();
  for (const fact of memory.facts) {
    const m = fact.text.match(AVOID_FACT_RE);
    if (m?.[1]) ids.add(m[1]!.trim());
  }
  return ids;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s，。！？、；：「」『』（）[\]{}<>《》"'`~!@#$%^&*+=|\\/.,;:?-]+/)
    .filter((t) => t.length >= 2);
}

/** 用户意图与历史成功路径的匹配分（越高越适合沿用） */
export function scoreLearnedProcedureMatch(
  userMessage: string,
  proc: LearnedProcedure,
  memory?: HermesPersistentMemory,
): number {
  const msg = userMessage.trim().toLowerCase();
  if (!msg) return 0;
  let score = 0;
  const trigger = proc.trigger.toLowerCase();
  for (const token of tokenize(userMessage)) {
    if (trigger.includes(token)) score += 2;
    if (msg.includes(token) && proc.stepLabels.toLowerCase().includes(token)) score += 1;
  }
  for (const toolId of proc.toolIds) {
    const hint = TOOL_INTENT_HINTS[toolId];
    if (hint?.test(userMessage)) score += 3;
  }
  if (memory) {
    const procHints = parseReflectionProcedureHints(memory).get(proc.procedureKey);
    if (procHints && procHints.length > 0) score += 5;
    for (const lesson of reflectionLessonsForMessage(memory, userMessage)) {
      const snippet = lesson.slice(0, 12);
      if (
        proc.trigger.includes(snippet) ||
        proc.stepLabels.includes(snippet) ||
        lesson.includes(proc.trigger.slice(0, 8))
      ) {
        score += 2;
      }
    }
  }
  return score;
}

function isRecoveryIntent(userMessage: string): boolean {
  return /重试|失败|修复|续跑|再试|恢复/.test(userMessage.trim());
}

export function scoreLearnedRecoveryMatch(
  userMessage: string,
  recovery: LearnedRecovery,
): number {
  const msg = userMessage.trim();
  if (!msg) return 0;
  let score = 0;
  const keyHint = RECOVERY_KEY_HINTS[recovery.memoryKey];
  if (keyHint?.test(msg)) score += 5;
  const trigger = recovery.trigger.toLowerCase();
  for (const token of tokenize(userMessage)) {
    if (trigger.includes(token)) score += 2;
  }
  for (const toolId of recovery.toolIds) {
    const hint = TOOL_INTENT_HINTS[toolId];
    if (hint?.test(msg)) score += 4;
  }
  return score;
}

export function pickBestLearnedRecovery(
  memory: HermesPersistentMemory,
  userMessage: string,
  minScore = 4,
): LearnedRecovery | null {
  if (!isRecoveryIntent(userMessage)) return null;
  const ranked = parseLearnedRecoveries(memory)
    .map((recovery) => ({
      recovery,
      score: scoreLearnedRecoveryMatch(userMessage, recovery),
    }))
    .filter((x) => x.score >= minScore)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.recovery ?? null;
}

export function pickBestLearnedProcedure(
  memory: HermesPersistentMemory,
  userMessage: string,
  minScore = 4,
): LearnedProcedure | null {
  const ranked = parseLearnedProcedures(memory)
    .map((proc) => ({
      proc,
      score: scoreLearnedProcedureMatch(userMessage, proc, memory),
    }))
    .filter((x) => x.score >= minScore)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.proc ?? null;
}

export function formatRecoveryExperiencesForPrompt(
  memory: HermesPersistentMemory,
  userMessage: string,
  limit = 2,
): string {
  if (!isRecoveryIntent(userMessage)) return "";
  const ranked = parseLearnedRecoveries(memory)
    .map((recovery) => ({
      recovery,
      score: scoreLearnedRecoveryMatch(userMessage, recovery),
    }))
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  if (ranked.length === 0) return "";
  const lines = ranked.map(({ recovery, score }, i) => {
    const labels = recovery.toolIds
      .map((id) => TOOL_STEP_LABELS[id] ?? id)
      .join(" → ");
    return `${i + 1}. [${recovery.memoryKey}] 曾${recovery.via}：「${recovery.trigger}」→ ${labels}（匹配 ${score}）`;
  });
  return [
    "本工程恢复成功经验（用户提及失败/重试时优先参考，单镜重试即可）：",
    ...lines,
  ].join("\n");
}

export function formatTopLearnedProceduresForPrompt(
  memory: HermesPersistentMemory,
  userMessage: string,
  limit = 2,
): string {
  const recoveryBlock = formatRecoveryExperiencesForPrompt(memory, userMessage, limit);
  const reflectHints = parseReflectionProcedureHints(memory);
  const ranked = parseLearnedProcedures(memory)
    .map((proc) => ({
      proc,
      score: scoreLearnedProcedureMatch(userMessage, proc, memory),
    }))
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  const procLines =
    ranked.length === 0
      ? []
      : [
          "本工程成功经验（规划时请优先参考相似路径，勿盲目缩短步骤链）：",
          ...ranked.map(({ proc, score }, i) => {
            const boost = reflectHints.get(proc.procedureKey)?.[0];
            const boostNote = boost ? `；复盘：${boost.slice(0, 48)}` : "";
            return `${i + 1}. [${proc.procedureKey}] 触发「${proc.trigger}」→ ${proc.stepLabels}（匹配度 ${score}${boostNote}）`;
          }),
        ];
  const looseReflect = reflectionLessonsForMessage(memory, userMessage);
  const extra =
    looseReflect.length > 0 ? [`近期复盘要点：${looseReflect.join("；")}`] : [];
  const parts = [...procLines, ...extra, recoveryBlock].filter(Boolean);
  return parts.join("\n");
}

export function formatAvoidSuggestionsForPrompt(memory: HermesPersistentMemory): string {
  const avoids = memory.facts
    .filter((f) => f.text.startsWith("[avoid:"))
    .slice(-6)
    .map((f) => f.text.replace(/^\[avoid:[^\]]+\]\s*/, "").trim() || f.text);
  if (avoids.length === 0) return "";
  return `用户已忽略的主动建议（勿再主动推荐同类）：\n${avoids.map((a) => `- ${a}`).join("\n")}`;
}

function planStepsFromProcedure(proc: LearnedProcedure): HermesPlanStep[] {
  return proc.toolIds.map((toolId) => ({
    id: crypto.randomUUID(),
    toolId,
    label: TOOL_STEP_LABELS[toolId] ?? toolId,
  }));
}

export function createDirectorPlanFromLearnedProcedure(
  proc: LearnedProcedure,
  userMessage: string,
): HermesDirectorPlan {
  return {
    id: crypto.randomUUID(),
    title: `沿用成功经验 · ${proc.stepLabels.slice(0, 36)}`,
    steps: planStepsFromProcedure(proc),
    sourceMessage: userMessage.trim(),
    plannerSource: "learned",
    assumptions: [`本工程曾成功：${proc.trigger}`],
  };
}

export function createDirectorPlanFromLearnedRecovery(
  recovery: LearnedRecovery,
  userMessage: string,
): HermesDirectorPlan {
  const steps = recovery.toolIds.map((toolId) => ({
    id: crypto.randomUUID(),
    toolId,
    label: TOOL_STEP_LABELS[toolId] ?? toolId,
  }));
  return {
    id: crypto.randomUUID(),
    title: `沿用恢复经验 · ${recovery.toolsLine.slice(0, 36)}`,
    steps,
    sourceMessage: userMessage.trim(),
    plannerSource: "learned",
    proactiveRecovery: true,
    orbSuggestionId: recovery.memoryKey,
    assumptions: [`本工程曾成功恢复：${recovery.trigger}`],
  };
}

function isWeakCatalogPlan(plan: HermesDirectorPlan): boolean {
  if (plan.steps.length !== 1) return false;
  const only = plan.steps[0]!;
  return (
    only.toolId === "canvas.summarize" &&
    (only.label.includes("请先打开") || Boolean(only.args?.catalogOnly))
  );
}

/**
 * 规则/LLM 未给出强计划时，用 memory 中 [proc:] 经验补全或替换。
 */
export function adaptDirectorPlanWithLearnedProcedures(
  plan: HermesDirectorPlan | null,
  memory: HermesPersistentMemory,
  userMessage: string,
): HermesDirectorPlan | null {
  const best = pickBestLearnedProcedure(memory, userMessage);
  if (!best) return plan;

  if (!plan || isWeakCatalogPlan(plan)) {
    return createDirectorPlanFromLearnedProcedure(best, userMessage);
  }

  const planKey = buildProcedureKey(plan.steps);
  if (planKey === best.procedureKey) return plan;

  if (best.procedureKey.startsWith(`${planKey}>`)) {
    const extraIds = best.toolIds.slice(plan.steps.length);
    if (extraIds.length === 0) return plan;
    const extraSteps = extraIds.map((toolId) => ({
      id: crypto.randomUUID(),
      toolId,
      label: TOOL_STEP_LABELS[toolId] ?? toolId,
    }));
    return {
      ...plan,
      title: `${plan.title}（补全学习路径）`,
      steps: [...plan.steps, ...extraSteps],
      assumptions: [...(plan.assumptions ?? []), `补全本工程常用后续：${best.stepLabels}`],
    };
  }

  return plan;
}

/**
 * 用户意图为失败/重试时，用 [recover:] 记忆补全或替换弱计划。
 */
export function adaptDirectorPlanWithLearnedRecoveries(
  plan: HermesDirectorPlan | null,
  memory: HermesPersistentMemory,
  userMessage: string,
): HermesDirectorPlan | null {
  const best = pickBestLearnedRecovery(memory, userMessage);
  if (!best) return plan;

  if (!plan || isWeakCatalogPlan(plan) || plan.steps.length === 0) {
    return createDirectorPlanFromLearnedRecovery(best, userMessage);
  }

  const hasRecoveryTool = plan.steps.some((s) => best.toolIds.includes(s.toolId));
  if (hasRecoveryTool) return plan;

  if (best.toolIds.length === 1) {
    const toolId = best.toolIds[0]!;
    const step: HermesPlanStep = {
      id: crypto.randomUUID(),
      toolId,
      label: TOOL_STEP_LABELS[toolId] ?? toolId,
    };
    return {
      ...plan,
      title: plan.title || `沿用恢复经验 · ${step.label}`,
      steps: [step, ...plan.steps].slice(0, 6),
      assumptions: [
        ...(plan.assumptions ?? []),
        `本工程曾成功恢复：${best.trigger}`,
      ],
      plannerSource: plan.plannerSource ?? "learned",
    };
  }

  return plan;
}

export async function recordAvoidProactiveSuggestion(
  projectPath: string,
  suggestionId: string,
  message?: string,
): Promise<void> {
  const id = suggestionId.trim();
  if (!id) return;
  const memory = await loadHermesPersistentMemory(projectPath);
  const prefix = `[avoid:${id}]`;
  if (memory.facts.some((f) => f.text.startsWith(prefix))) return;
  const note = message?.trim() ? ` ${message.trim().slice(0, 80)}` : "";
  await appendHermesMemoryFact(projectPath, `${prefix}${note}`, "user");
}

export async function applyLearnedAdaptationToPlan(
  plan: HermesDirectorPlan | null,
  projectPath: string | null,
  userMessage: string,
): Promise<HermesDirectorPlan | null> {
  if (!projectPath?.trim()) return plan;
  const memory = await loadHermesPersistentMemory(projectPath);
  const withProc = adaptDirectorPlanWithLearnedProcedures(plan, memory, userMessage);
  return adaptDirectorPlanWithLearnedRecoveries(withProc, memory, userMessage);
}
