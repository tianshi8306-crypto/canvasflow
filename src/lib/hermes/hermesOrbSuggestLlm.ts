import { invoke, isTauri } from "@tauri-apps/api/core";
import type { HermesOrbSuggestion } from "@/lib/hermes/hermesOrbSuggestions.types";
import {
  formatHermesSituationForLlm,
  type HermesSituation,
} from "@/lib/hermes/hermesSituation";
import { extractJsonObject } from "@/lib/hermes/hermesPlanParse";
import { fetchHermesKnowledgeBlockForSituation } from "@/lib/hermes/knowledge/hermesKnowledgeSearch";
import { formatHermesExpertDoctrineForLlm } from "@/lib/hermes/hermesProductionExpert";
import { pickHermesLlmProvider } from "@/lib/hermes/pickHermesProvider";

export type OrbSuggestLlmPayload = {
  message?: string;
  actionLabel?: string;
  actionPrompt?: string;
};

export function parseOrbSuggestLlmPayload(raw: string): OrbSuggestLlmPayload | null {
  return extractJsonObject<OrbSuggestLlmPayload>(raw);
}

export function mergeOrbLlmEnhancement(
  base: HermesOrbSuggestion,
  llm: OrbSuggestLlmPayload | null,
): HermesOrbSuggestion {
  if (!llm) return base;
  const message = llm.message?.trim();
  const actionLabel = llm.actionLabel?.trim();
  const actionPrompt = llm.actionPrompt?.trim();
  if (!message && !actionLabel && !actionPrompt) return base;
  return {
    ...base,
    message: message && message.length <= 80 ? message : base.message,
    actionLabel: actionLabel && actionLabel.length <= 12 ? actionLabel : base.actionLabel,
    actionPrompt: actionPrompt && actionPrompt.length <= 300 ? actionPrompt : base.actionPrompt,
  };
}

export async function enhanceOrbSuggestionWithLlm(
  base: HermesOrbSuggestion,
  situation: HermesSituation,
  projectPath: string,
): Promise<HermesOrbSuggestion> {
  if (!isTauri()) return base;
  const provider = await pickHermesLlmProvider();
  if (!provider) return base;

  let situationSummary = formatHermesSituationForLlm(situation);
  const doctrine = formatHermesExpertDoctrineForLlm();
  if (doctrine) {
    situationSummary = `${situationSummary}\n\n${doctrine}`;
  }
  const knowledge = await fetchHermesKnowledgeBlockForSituation(
    situation,
    projectPath,
    base.actionPrompt,
  );
  if (knowledge) {
    situationSummary = `${situationSummary}${knowledge}`;
  }

  const ruleDraft = JSON.stringify({
    id: base.id,
    severity: base.severity,
    message: base.message,
    actionLabel: base.actionLabel,
    actionPrompt: base.actionPrompt,
  });

  try {
    const raw = await invoke<string>("hermes_orb_suggest", {
      situationSummary,
      ruleDraftJson: ruleDraft,
      providerId: provider.providerId,
      model: provider.model,
    });
    return mergeOrbLlmEnhancement(base, parseOrbSuggestLlmPayload(raw));
  } catch {
    return base;
  }
}
