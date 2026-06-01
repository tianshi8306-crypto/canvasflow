import {
  loadHermesChatHistory,
  type HermesChatMessage,
} from "@/lib/hermes/hermesChatHistory";
import { hermesChatStorageScope } from "@/lib/hermes/hermesChatScope";
import { trimChatHistoryForLlm } from "@/lib/hermes/agent/hermesLongContext";

const STORAGE_PREFIX = "canvasflow.hermesChat.v1";

export type HermesCanvasTabRef = {
  id: string;
  name?: string | null;
};

/** 从 localStorage 枚举本工程已存过聊天的 Tab id */
export function listStoredHermesChatTabIds(projectPath: string | null): string[] {
  if (typeof localStorage === "undefined") return [];
  const path = projectPath?.trim() || "__draft__";
  const prefix = `${STORAGE_PREFIX}:${path}::`;
  const ids = new Set<string>();
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key?.startsWith(prefix)) continue;
    const tabId = key.slice(prefix.length);
    if (tabId) ids.add(tabId);
  }
  return [...ids];
}

export function resolveHermesTabsForDigest(
  projectPath: string | null,
  canvasTabs: HermesCanvasTabRef[] | undefined,
): HermesCanvasTabRef[] {
  const byId = new Map<string, HermesCanvasTabRef>();
  for (const t of canvasTabs ?? []) {
    if (t.id?.trim()) byId.set(t.id, { id: t.id, name: t.name });
  }
  for (const id of listStoredHermesChatTabIds(projectPath)) {
    if (!byId.has(id)) byId.set(id, { id, name: null });
  }
  return [...byId.values()];
}

function tabDisplayName(tab: HermesCanvasTabRef): string {
  const n = tab.name?.trim();
  return n || "画布";
}

function prefixTabMessages(
  tab: HermesCanvasTabRef,
  messages: HermesChatMessage[],
): HermesChatMessage[] {
  const label = tabDisplayName(tab);
  return messages.map((m) => ({
    ...m,
    id: `${tab.id}:${m.id}`,
    content: `【${label}】 ${m.content}`,
  }));
}

/**
 * 收集各 Tab 尚未纳入工程级 digest 的消息（活跃 Tab 仅「较早」段，其它 Tab 为增量段）。
 */
export function collectCrossTabDigestMessages(opts: {
  projectPath: string | null;
  canvasTabs?: HermesCanvasTabRef[];
  activeTabId: string | null;
  activeMessages: HermesChatMessage[];
  tabDigestedCounts: Record<string, number>;
}): {
  messages: HermesChatMessage[];
  nextTabDigestedCounts: Record<string, number>;
} {
  const tabs = resolveHermesTabsForDigest(opts.projectPath, opts.canvasTabs);
  if (tabs.length === 0) {
    const { olderForDigest } = trimChatHistoryForLlm(opts.activeMessages);
    return {
      messages: olderForDigest,
      nextTabDigestedCounts: opts.tabDigestedCounts,
    };
  }

  const out: HermesChatMessage[] = [];
  const nextCounts = { ...opts.tabDigestedCounts };
  const activeId = opts.activeTabId?.trim() || null;

  for (const tab of tabs) {
    const msgs =
      activeId && tab.id === activeId
        ? opts.activeMessages
        : loadHermesChatHistory(opts.projectPath, tab.id);
    if (msgs.length === 0) continue;

    const digested = Math.max(0, nextCounts[tab.id] ?? 0);
    let endExclusive = msgs.length;
    if (activeId && tab.id === activeId) {
      const { recent } = trimChatHistoryForLlm(msgs);
      endExclusive = Math.max(0, msgs.length - recent.length);
    }

    if (endExclusive <= digested) continue;

    const slice = prefixTabMessages(tab, msgs.slice(digested, endExclusive));
    out.push(...slice);
    nextCounts[tab.id] = endExclusive;
  }

  return { messages: out, nextTabDigestedCounts: nextCounts };
}

/** 调试用：某 Tab 的 storage scope */
export function hermesChatScopeForTab(
  projectPath: string | null,
  tabId: string,
): string {
  return hermesChatStorageScope(projectPath, tabId);
}
