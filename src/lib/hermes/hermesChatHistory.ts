export type HermesChatRole = "user" | "assistant";

import type { HermesChatMediaPreview } from "@/lib/hermes/hermesChatMediaPreview";

export type HermesChatMessage = {
  id: string;
  role: HermesChatRole;
  content: string;
  preview?: HermesChatMediaPreview;
};

import {
  hermesChatLegacyStorageScope,
  hermesChatStorageScope,
} from "@/lib/hermes/hermesChatScope";

const STORAGE_PREFIX = "canvasflow.hermesChat.v1";

function storageKey(scope: string): string {
  return `${STORAGE_PREFIX}:${scope}`;
}

export function loadHermesChatHistory(
  projectPath: string | null,
  tabId?: string | null,
): HermesChatMessage[] {
  if (typeof localStorage === "undefined") return [];
  const scope = hermesChatStorageScope(projectPath, tabId ?? null);
  try {
    let raw = localStorage.getItem(storageKey(scope));
    if (!raw && tabId) {
      raw = localStorage.getItem(storageKey(hermesChatLegacyStorageScope(projectPath)));
      if (raw) {
        localStorage.setItem(storageKey(scope), raw);
      }
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HermesChatMessage[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    );
  } catch {
    return [];
  }
}

export function saveHermesChatHistory(
  projectPath: string | null,
  messages: HermesChatMessage[],
  tabId?: string | null,
): void {
  if (typeof localStorage === "undefined") return;
  try {
    const trimmed = messages.slice(-80);
    const scope = hermesChatStorageScope(projectPath, tabId ?? null);
    localStorage.setItem(storageKey(scope), JSON.stringify(trimmed));
  } catch {
    /* ignore */
  }
}

export function clearHermesChatHistory(
  projectPath: string | null,
  tabId?: string | null,
): void {
  if (typeof localStorage === "undefined") return;
  try {
    const scope = hermesChatStorageScope(projectPath, tabId ?? null);
    localStorage.removeItem(storageKey(scope));
  } catch {
    /* ignore */
  }
}

export function toLlmHistory(messages: HermesChatMessage[]): Array<{ role: string; content: string }> {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}
