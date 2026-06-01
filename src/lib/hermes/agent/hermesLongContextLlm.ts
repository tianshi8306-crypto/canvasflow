import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  buildConversationDigest,
  HERMES_CONVERSATION_DIGEST_MAX,
  HERMES_PROJECT_SUMMARY_MAX,
} from "@/lib/hermes/agent/hermesLongContext";
import { shouldUseLongContextLlmSummary } from "@/lib/hermes/agent/hermesAgentSettings";
import type { HermesChatMessage } from "@/lib/hermes/hermesChatHistory";
import {
  pickHermesLlmProvider,
  type HermesLlmBinding,
} from "@/lib/hermes/pickHermesProvider";

const CONVERSATION_DIGEST_SYSTEM = `你是 Hermes 制片助手。将较早对话压缩为要点列表。
保留：用户目标、镜号/镜头决策、已执行或计划的操作、失败原因、用户约束（画幅/风格/禁止项）。
不要编造未出现的内容。中文，每条一行，最多 20 条，总长不超过 1200 字。`;

const PROJECT_SUMMARY_SYSTEM = `你是 Hermes 制片助手。根据下方工程材料写紧凑制片摘要。
包含：创意梗概、镜头表要点（镜号+一句话）、已就绪分镜 visual 要点、项目圣经约束。
不要编造材料中未出现的镜头。中文，不超过 1000 字。`;

function trimToMax(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function formatMessagesForLlm(messages: HermesChatMessage[]): string {
  return messages
    .map((m) => {
      const role = m.role === "user" ? "用户" : "Hermes";
      return `${role}：${m.content.trim()}`;
    })
    .filter((line) => line.length > 2)
    .join("\n");
}

async function llmComplete(
  provider: HermesLlmBinding,
  systemPrompt: string,
  userPrompt: string,
): Promise<string | null> {
  try {
    const raw = await invoke<string>("llm_complete_text", {
      systemPrompt,
      userPrompt,
      providerId: provider.providerId,
      model: provider.model || undefined,
    });
    const text = raw.trim();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

/** 用 LLM 压缩较早对话；失败返回 null（由调用方回退规则摘要） */
export async function summarizeConversationDigestWithLlm(opts: {
  olderMessages: HermesChatMessage[];
  existingDigest?: string;
  provider?: HermesLlmBinding | null;
}): Promise<string | null> {
  if (opts.olderMessages.length === 0) return null;
  const provider = opts.provider ?? (await pickHermesLlmProvider());
  if (!provider) return null;

  const transcript = formatMessagesForLlm(opts.olderMessages);
  const ruleFallback = buildConversationDigest(opts.olderMessages);
  const userParts: string[] = [];
  if (opts.existingDigest?.trim()) {
    userParts.push(`【已有摘要】\n${opts.existingDigest.trim()}`);
  }
  userParts.push(`【待压缩对话】\n${transcript}`);
  if (ruleFallback.trim()) {
    userParts.push(`【规则压缩参考（可合并，勿照抄冗长部分）】\n${ruleFallback}`);
  }

  const out = await llmComplete(provider, CONVERSATION_DIGEST_SYSTEM, userParts.join("\n\n"));
  return out ? trimToMax(out, HERMES_CONVERSATION_DIGEST_MAX) : null;
}

/** 用 LLM 精炼工程上下文；失败返回 null */
export async function summarizeProjectContextWithLlm(opts: {
  ruleBasedDraft: string;
  provider?: HermesLlmBinding | null;
}): Promise<string | null> {
  const draft = opts.ruleBasedDraft.trim();
  if (!draft) return null;
  const provider = opts.provider ?? (await pickHermesLlmProvider());
  if (!provider) return null;

  const userPrompt = `【工程材料（规则提取）】\n${draft}`;
  const out = await llmComplete(provider, PROJECT_SUMMARY_SYSTEM, userPrompt);
  return out ? trimToMax(out, HERMES_PROJECT_SUMMARY_MAX) : null;
}

export async function resolveLongContextLlmProvider(): Promise<HermesLlmBinding | null> {
  if (!isTauri() || !shouldUseLongContextLlmSummary()) return null;
  return pickHermesLlmProvider();
}

/** 工程摘要是否值得调用 LLM（避免空工程频繁请求） */
export function shouldLlmSummarizeProject(ruleDraft: string): boolean {
  const t = ruleDraft.trim();
  return t.length >= 280;
}

/** 对话是否值得 LLM 摘要 */
export function shouldLlmSummarizeConversation(olderCount: number): boolean {
  return olderCount >= 2;
}
