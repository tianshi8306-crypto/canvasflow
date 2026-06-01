import type { Edge, Node } from "@xyflow/react";
import { findPrimaryScriptNode } from "@/lib/hermes/hermesCanvasContext";
import {
  loadHermesWorkstate,
  saveHermesWorkstate,
  type HermesWorkstate,
} from "@/lib/hermes/agent/hermesWorkstate";
import type { HermesChatMessage } from "@/lib/hermes/hermesChatHistory";
import { toLlmHistory } from "@/lib/hermes/hermesChatHistory";
import { formatBibleForHermesContext } from "@/lib/projectBible/bibleRoleBindings";
import type { ProjectBible } from "@/lib/projectBible/projectBible";
import { normalizeScriptBeats } from "@/lib/scriptBeatHelpers";
import type { FlowNodeData, StoryboardShot } from "@/lib/types";
import {
  resolveLongContextLlmProvider,
  shouldLlmSummarizeConversation,
  shouldLlmSummarizeProject,
  summarizeConversationDigestWithLlm,
  summarizeProjectContextWithLlm,
} from "@/lib/hermes/agent/hermesLongContextLlm";
import {
  collectCrossTabDigestMessages,
  resolveHermesTabsForDigest,
  type HermesCanvasTabRef,
} from "@/lib/hermes/hermesCrossTabDigest";
import { loadHermesChatHistory } from "@/lib/hermes/hermesChatHistory";

/** 送入 LLM 的完整近期轮数 */
export const HERMES_CHAT_RECENT_TURNS = 12;
export const HERMES_PROJECT_SUMMARY_MAX = 2400;
export const HERMES_CONVERSATION_DIGEST_MAX = 1800;
export const HERMES_CONSTRAINTS_MAX = 8;

function trimChars(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function readyShots(shots: StoryboardShot[] | undefined): StoryboardShot[] {
  return (shots ?? []).filter(
    (s) => s.status === "generated" && Boolean(s.visualPrompt?.trim()),
  );
}

/** 规则型工程摘要：梗概 + 镜头表 + 分镜要点 + 圣经（供规划/对话注入） */
export function buildProjectContextSummary(opts: {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  bible: ProjectBible | null;
  maxChars?: number;
}): string {
  void opts.edges;
  const lines: string[] = [];
  const script = findPrimaryScriptNode(opts.nodes);
  const brief = (script?.data.prompt ?? "").toString().trim();
  if (brief) {
    lines.push(`梗概：${trimChars(brief, 480)}`);
  }

  const beats = normalizeScriptBeats(script?.data.scriptBeats);
  if (beats.length > 0) {
    lines.push(`镜头表（共 ${beats.length} 镜，摘要）：`);
    const cap = Math.min(beats.length, 28);
    for (let i = 0; i < cap; i += 1) {
      const b = beats[i]!;
      const num = (b.shotNumber || "").trim() || String(i + 1);
      const desc = trimChars((b.description ?? "").toString(), 72);
      lines.push(`- 镜 ${num}：${desc || "（无描述）"}`);
    }
    if (beats.length > cap) {
      lines.push(`- …另有 ${beats.length - cap} 镜未列出`);
    }
  }

  const shots = readyShots(script?.data.storyboardShots);
  if (shots.length > 0) {
    lines.push(`分镜 visualPrompt（${shots.length} 镜就绪，摘要）：`);
    const beatById = new Map(beats.map((b) => [b.id, b]));
    for (const s of shots.slice(0, 14)) {
      const beat = beatById.get(s.scriptBeatId);
      const num = (beat?.shotNumber || "").trim() || "?";
      lines.push(`- 镜 ${num}：${trimChars(s.visualPrompt ?? "", 56)}`);
    }
    if (shots.length > 14) {
      lines.push(`- …另有 ${shots.length - 14} 镜分镜`);
    }
  }

  const bibleBlock = formatBibleForHermesContext(opts.bible);
  if (bibleBlock.trim()) {
    lines.push(trimChars(bibleBlock, 400));
  }

  if (!script && !brief && beats.length === 0) {
    return "";
  }

  return lines.join("\n").slice(0, opts.maxChars ?? HERMES_PROJECT_SUMMARY_MAX);
}

/** 将较早对话压成要点列表 */
export function buildConversationDigest(
  messages: HermesChatMessage[],
  maxBullets = 18,
): string {
  const bullets: string[] = [];
  for (const m of messages) {
    const body = m.content.trim();
    if (!body) continue;
    const role = m.role === "user" ? "用户" : "灵体";
    bullets.push(`${role}：${trimChars(body, 140)}`);
  }
  return bullets.slice(-maxBullets).join("\n").slice(0, HERMES_CONVERSATION_DIGEST_MAX);
}

function mergeConversationDigests(prev: string | undefined, next: string): string {
  if (!prev?.trim()) return next;
  if (!next.trim()) return prev;
  const lines = [...prev.split("\n"), ...next.split("\n")].filter(Boolean);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const line of lines) {
    if (seen.has(line)) continue;
    seen.add(line);
    unique.push(line);
  }
  return unique.slice(-24).join("\n").slice(0, HERMES_CONVERSATION_DIGEST_MAX);
}

/** 从用户句提取可持续约束（记住/不要/必须） */
export function extractUserConstraintsFromMessages(
  messages: HermesChatMessage[],
): string[] {
  const found: string[] = [];
  const patterns = [
    /记住[：: ]?([^。\n]{2,80})/g,
    /务必[：: ]?([^。\n]{2,80})/g,
    /不要[：: ]?([^。\n]{2,80})/g,
    /必须[：: ]?([^。\n]{2,80})/g,
    /限定[：: ]?([^。\n]{2,80})/g,
  ];
  for (const m of messages) {
    if (m.role !== "user") continue;
    for (const re of patterns) {
      let match: RegExpExecArray | null;
      const r = new RegExp(re.source, re.flags);
      while ((match = r.exec(m.content)) !== null) {
        const chunk = match[1]?.trim();
        if (chunk && chunk.length >= 2) found.push(chunk);
      }
    }
  }
  return [...new Set(found)].slice(-HERMES_CONSTRAINTS_MAX);
}

export function trimChatHistoryForLlm(messages: HermesChatMessage[]): {
  history: Array<{ role: string; content: string }>;
  olderForDigest: HermesChatMessage[];
  recent: HermesChatMessage[];
} {
  if (messages.length <= HERMES_CHAT_RECENT_TURNS) {
    return {
      history: toLlmHistory(messages),
      olderForDigest: [],
      recent: messages,
    };
  }
  const recent = messages.slice(-HERMES_CHAT_RECENT_TURNS);
  const olderForDigest = messages.slice(0, -HERMES_CHAT_RECENT_TURNS);
  return {
    history: toLlmHistory(recent),
    olderForDigest,
    recent,
  };
}

export function formatLongContextForPrompt(ws: Pick<
  HermesWorkstate,
  "projectContextSummary" | "conversationDigest" | "userConstraints"
>): string {
  const lines: string[] = [];
  if (ws.projectContextSummary?.trim()) {
    lines.push("【工程上下文摘要】", ws.projectContextSummary.trim());
  }
  if (ws.conversationDigest?.trim()) {
    lines.push("【较早对话摘要（含其它画布 Tab）】", ws.conversationDigest.trim());
  }
  if (ws.userConstraints && ws.userConstraints.length > 0) {
    lines.push(
      "【用户约束】",
      ...ws.userConstraints.map((c) => `- ${c}`),
    );
  }
  return lines.join("\n");
}

/** 刷新 workstate 中的长上下文字段并持久化 */
function loadAllTabMessagesForConstraints(
  projectPath: string,
  canvasTabs: HermesCanvasTabRef[] | undefined,
  activeTabId: string | null,
  activeMessages: HermesChatMessage[],
): HermesChatMessage[] {
  const tabs = resolveHermesTabsForDigest(projectPath, canvasTabs);
  const activeId = activeTabId?.trim() || null;
  const merged: HermesChatMessage[] = [];
  for (const tab of tabs) {
    const msgs =
      activeId && tab.id === activeId
        ? activeMessages
        : loadHermesChatHistory(projectPath, tab.id);
    merged.push(...msgs);
  }
  if (merged.length === 0) return activeMessages;
  return merged;
}

export async function refreshHermesLongContext(
  projectPath: string,
  opts: {
    nodes: Node<FlowNodeData>[];
    edges: Edge[];
    bible: ProjectBible | null;
    chatMessages?: HermesChatMessage[];
    activeTabId?: string | null;
    canvasTabs?: HermesCanvasTabRef[];
  },
): Promise<HermesWorkstate> {
  const prev = await loadHermesWorkstate(projectPath);
  const ruleProjectSummary = buildProjectContextSummary({
    nodes: opts.nodes,
    edges: opts.edges,
    bible: opts.bible,
  });
  let projectContextSummary = ruleProjectSummary || prev.projectContextSummary;

  const llmProvider = await resolveLongContextLlmProvider();
  if (
    llmProvider &&
    ruleProjectSummary &&
    shouldLlmSummarizeProject(ruleProjectSummary)
  ) {
    const llmProject = await summarizeProjectContextWithLlm({
      ruleBasedDraft: ruleProjectSummary,
      provider: llmProvider,
    });
    if (llmProject) projectContextSummary = llmProject;
  }

  let conversationDigest = prev.conversationDigest;
  let digestedMessageCount = prev.digestedMessageCount ?? 0;
  let userConstraints = prev.userConstraints ?? [];

  const activeMessages = opts.chatMessages ?? [];
  const constraintSource = loadAllTabMessagesForConstraints(
    projectPath,
    opts.canvasTabs,
    opts.activeTabId ?? null,
    activeMessages,
  );
  if (constraintSource.length > 0) {
    userConstraints = extractUserConstraintsFromMessages(constraintSource);
  }

  const { messages: crossTabOlder, nextTabDigestedCounts } =
    collectCrossTabDigestMessages({
      projectPath,
      canvasTabs: opts.canvasTabs,
      activeTabId: opts.activeTabId ?? null,
      activeMessages,
      tabDigestedCounts: prev.tabDigestedCounts ?? {},
    });

  if (crossTabOlder.length > 0) {
    const chunk = buildConversationDigest(crossTabOlder);
    if (llmProvider && shouldLlmSummarizeConversation(crossTabOlder.length)) {
      const llmDigest = await summarizeConversationDigestWithLlm({
        olderMessages: crossTabOlder,
        existingDigest: conversationDigest,
        provider: llmProvider,
      });
      if (llmDigest) {
        conversationDigest = llmDigest;
      } else {
        conversationDigest = mergeConversationDigests(conversationDigest, chunk);
      }
    } else {
      conversationDigest = mergeConversationDigests(conversationDigest, chunk);
    }
    digestedMessageCount = Object.values(nextTabDigestedCounts).reduce(
      (sum, n) => sum + n,
      0,
    );
  }

  const next: HermesWorkstate = {
    ...prev,
    projectContextSummary: projectContextSummary || undefined,
    conversationDigest: conversationDigest || undefined,
    digestedMessageCount:
      digestedMessageCount > 0 ? digestedMessageCount : undefined,
    tabDigestedCounts:
      Object.keys(nextTabDigestedCounts).length > 0
        ? nextTabDigestedCounts
        : prev.tabDigestedCounts,
    userConstraints: userConstraints.length > 0 ? userConstraints : undefined,
    updatedAt: new Date().toISOString(),
  };

  await saveHermesWorkstate(projectPath, next);
  return next;
}
