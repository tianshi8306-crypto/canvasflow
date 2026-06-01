import { invoke, isTauri } from "@tauri-apps/api/core";
import type {
  HermesDirectorPlan,
  HermesPlanExecutionState,
} from "@/lib/hermes/hermesDirectorTypes";
import { shouldUsePostJobLlmReflect } from "@/lib/hermes/agent/hermesAgentSettings";
import {
  completedStepsFromState,
  findFailedStep,
} from "@/lib/hermes/agent/hermesJobReflection";
import { HERMES_JOB_CANCELLED_ERROR } from "@/lib/hermes/agent/hermesJobStore";
import {
  pickHermesLlmProvider,
  type HermesLlmBinding,
} from "@/lib/hermes/pickHermesProvider";

const REFLECT_SYSTEM = `你是 Hermes 制片 Agent 的复盘模块。根据任务执行摘要，输出可写入工程长期记忆的简短结论。
只输出一个 JSON 对象，不要 markdown 围栏或其它文字。字段均为可选字符串（≤120 字）：
{
  "lesson": "可复用的成功经验或流程要点",
  "avoid": "下次应避免的误区（若失败或部分失败）",
  "profile": "用户偏好/约束补充（仅当材料中明确出现）"
}
不要编造未出现在材料中的镜号、API 结果或用户未说的偏好。`;

export type LlmJobReflectionParsed = {
  lesson?: string;
  avoid?: string;
  profile?: string;
};

export function buildJobReflectionUserPrompt(
  plan: HermesDirectorPlan,
  state: HermesPlanExecutionState,
): string {
  const completed = completedStepsFromState(plan, state);
  const failed = findFailedStep(plan, state);
  const lines: string[] = [
    `用户意图：${plan.sourceMessage.trim() || plan.title}`,
    `计划标题：${plan.title}`,
    `结果：${state.error ? `失败 — ${state.error}` : "成功"}`,
  ];
  if (completed.length > 0) {
    lines.push(
      "已完成步骤：",
      ...completed.map((s, i) => `${i + 1}. ${s.label} (${s.toolId})`),
    );
  }
  if (failed) {
    lines.push(`失败步骤：${failed.label} (${failed.toolId})`);
  }
  const pending = plan.steps.filter(
    (s) =>
      state.stepStatuses[s.id] !== "done" &&
      state.stepStatuses[s.id] !== "failed",
  );
  if (pending.length > 0 && state.error) {
    lines.push(
      "未执行步骤：",
      ...pending.map((s) => `- ${s.label}`),
    );
  }
  return lines.join("\n");
}

export function parseLlmJobReflectionResponse(raw: string): LlmJobReflectionParsed | null {
  const t = raw.trim();
  if (!t) return null;
  const jsonMatch = t.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const pick = (key: string) => {
      const v = parsed[key];
      if (typeof v !== "string") return undefined;
      const s = v.trim();
      return s.length > 0 ? s.slice(0, 200) : undefined;
    };
    const lesson = pick("lesson");
    const avoid = pick("avoid");
    const profile = pick("profile");
    if (!lesson && !avoid && !profile) return null;
    return { lesson, avoid, profile };
  } catch {
    return null;
  }
}

export function formatLlmReflectionMemoryFacts(
  parsed: LlmJobReflectionParsed,
): string[] {
  const out: string[] = [];
  if (parsed.lesson?.trim()) {
    out.push(`[reflect] ${parsed.lesson.trim()}`);
  }
  if (parsed.avoid?.trim()) {
    out.push(`[avoid:llm_reflect] ${parsed.avoid.trim()}`);
  }
  return out;
}

export function shouldRunLlmJobReflection(
  plan: HermesDirectorPlan,
  state: HermesPlanExecutionState,
): boolean {
  if (state.error === HERMES_JOB_CANCELLED_ERROR) return false;
  if (!shouldUsePostJobLlmReflect()) return false;
  const completed = completedStepsFromState(plan, state);
  if (plan.isRecovery && !state.error && !plan.proactiveRecovery) {
    return completed.length >= 1;
  }
  if (state.error) return completed.length > 0 || Boolean(findFailedStep(plan, state));
  return completed.length >= 1;
}

async function llmComplete(
  provider: HermesLlmBinding,
  userPrompt: string,
): Promise<string | null> {
  try {
    const raw = await invoke<string>("llm_complete_text", {
      systemPrompt: REFLECT_SYSTEM,
      userPrompt,
      providerId: provider.providerId,
      model: provider.model || undefined,
    });
    return raw.trim() || null;
  } catch {
    return null;
  }
}

export async function runLlmJobReflection(
  plan: HermesDirectorPlan,
  state: HermesPlanExecutionState,
  opts?: { provider?: HermesLlmBinding | null },
): Promise<LlmJobReflectionParsed | null> {
  if (!isTauri() || !shouldRunLlmJobReflection(plan, state)) {
    return null;
  }

  const provider = opts?.provider ?? (await pickHermesLlmProvider());
  if (!provider) return null;

  const userPrompt = buildJobReflectionUserPrompt(plan, state);
  const raw = await llmComplete(provider, userPrompt);
  if (!raw) return null;

  return parseLlmJobReflectionResponse(raw);
}
