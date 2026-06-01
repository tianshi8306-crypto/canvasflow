import {
  shouldAutoActOrbSuggestion,
} from "@/lib/hermes/hermesProactivePolicy";
import {
  shouldAutoExecutePlans,
  shouldProactiveRecoveryAutoAct,
} from "@/lib/hermes/agent/hermesAgentSettings";

export const HERMES_ORB_AUTO_ACT_EVENT = "canvasflow-hermes-orb-auto-act";

export type HermesOrbAutoActDetail = {
  prompt: string;
  suggestionId: string;
};

let pendingOrbPlanOrigin: { suggestionId: string } | null = null;

export function setPendingOrbPlanOrigin(suggestionId: string): void {
  const id = suggestionId.trim();
  if (!id) return;
  pendingOrbPlanOrigin = { suggestionId: id };
}

export function consumePendingOrbPlanOrigin(): { suggestionId: string } | null {
  const v = pendingOrbPlanOrigin;
  pendingOrbPlanOrigin = null;
  return v;
}

const AUTO_ACT_SESSION_PREFIX = "canvasflow.hermesOrbAutoActed:";

function sessionKey(projectPath: string, suggestionId: string, prompt: string): string {
  return `${projectPath}:${suggestionId}:${prompt.trim().slice(0, 64)}`;
}

export function wasOrbSuggestionAutoActed(
  projectPath: string,
  suggestionId: string,
  prompt: string,
): boolean {
  if (typeof sessionStorage === "undefined") return false;
  const key = `${AUTO_ACT_SESSION_PREFIX}${sessionKey(projectPath, suggestionId, prompt)}`;
  return sessionStorage.getItem(key) === "1";
}

export function markOrbSuggestionAutoActed(
  projectPath: string,
  suggestionId: string,
  prompt: string,
): void {
  if (typeof sessionStorage === "undefined") return;
  const key = `${AUTO_ACT_SESSION_PREFIX}${sessionKey(projectPath, suggestionId, prompt)}`;
  sessionStorage.setItem(key, "1");
}

export function canOrbProactiveAutoAct(
  suggestionId: string,
  projectPath: string | null,
  prompt: string,
): boolean {
  if (!projectPath?.trim()) return false;
  if (!shouldProactiveRecoveryAutoAct()) return false;
  if (!shouldAutoExecutePlans()) return false;
  if (!shouldAutoActOrbSuggestion(suggestionId)) return false;
  if (!prompt.trim()) return false;
  if (wasOrbSuggestionAutoActed(projectPath, suggestionId, prompt)) return false;
  return true;
}

export function dispatchHermesOrbAutoAct(detail: HermesOrbAutoActDetail): void {
  setPendingOrbPlanOrigin(detail.suggestionId);
  window.dispatchEvent(
    new CustomEvent<HermesOrbAutoActDetail>(HERMES_ORB_AUTO_ACT_EVENT, { detail }),
  );
}
