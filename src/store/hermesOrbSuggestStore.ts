import { create } from "zustand";
import { buildHermesSituation } from "@/lib/hermes/hermesSituation";
import {
  expandProactiveDismissIds,
  pickHermesOrbSuggestion,
  productionFingerprint,
  type HermesOrbSuggestion,
} from "@/lib/hermes/hermesOrbSuggestions";
import { enhanceOrbSuggestionWithLlm } from "@/lib/hermes/hermesOrbSuggestLlm";
import { shouldEnhanceOrbSuggestionWithLlm } from "@/lib/hermes/hermesProactivePolicy";
import { countFailed } from "@/lib/hermes/hermesTaskTrack";
import { getCachedCanvasEvents } from "@/lib/hermes/agent/hermesCanvasEventCache";
import { useHermesTaskStore } from "@/store/hermesTaskStore";
import { useProjectBibleStore } from "@/store/projectBibleStore";
import { useProjectStore } from "@/store/projectStore";

const DISMISS_KEY = "canvasflow.hermesOrbDismissed.v1";
const REFRESH_DEBOUNCE_MS = 550;

let refreshDebounceTimer: ReturnType<typeof setTimeout> | undefined;
let refreshSeq = 0;
const llmEnhanceCache = new Map<string, HermesOrbSuggestion>();

function loadDismissed(projectPath: string | null): Set<string> {
  if (!projectPath || typeof sessionStorage === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(`${DISMISS_KEY}:${projectPath}`);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(projectPath: string, ids: Set<string>) {
  if (typeof sessionStorage === "undefined") return;
  const list = [...ids].slice(-24);
  sessionStorage.setItem(`${DISMISS_KEY}:${projectPath}`, JSON.stringify(list));
}

function trimLlmCache() {
  if (llmEnhanceCache.size <= 32) return;
  const first = llmEnhanceCache.keys().next().value;
  if (first) llmEnhanceCache.delete(first);
}

type State = {
  suggestion: HermesOrbSuggestion | null;
  /** 画布节点生成失败等即时建议，优先于规则建议直至用户关闭 */
  ephemeralSuggestion: HermesOrbSuggestion | null;
  prevFingerprint: string | null;
  dismissedIds: Set<string>;
  refresh: () => void;
  refreshAsync: () => Promise<void>;
  pushEphemeralSuggestion: (suggestion: HermesOrbSuggestion) => void;
  dismissCurrent: () => void;
  reset: () => void;
};

export const useHermesOrbSuggestStore = create<State>((set, get) => ({
  suggestion: null,
  ephemeralSuggestion: null,
  prevFingerprint: null,
  dismissedIds: new Set(),

  pushEphemeralSuggestion: (suggestion) => {
    set({ ephemeralSuggestion: suggestion, suggestion });
  },

  refresh: () => {
    if (refreshDebounceTimer) clearTimeout(refreshDebounceTimer);
    refreshDebounceTimer = setTimeout(() => {
      void get().refreshAsync();
    }, REFRESH_DEBOUNCE_MS);
  },

  refreshAsync: async () => {
    const seq = ++refreshSeq;
    const projectPath = useProjectStore.getState().projectPath?.trim();
    const nodes = useProjectStore.getState().nodes;
    const edges = useProjectStore.getState().edges;
    const selectedNodeIds = useProjectStore.getState().selectedNodeIds;
    const bible = useProjectBibleStore.getState().bible;
    const failedTaskCount = countFailed(useHermesTaskStore.getState().tasks);

    if (!projectPath) {
      set({ suggestion: null, ephemeralSuggestion: null, prevFingerprint: null, dismissedIds: new Set() });
      return;
    }

    const ephemeral = get().ephemeralSuggestion;

    const situation = buildHermesSituation(nodes, edges, projectPath, {
      selectedNodeIds,
      bible,
    });
    const fp = productionFingerprint(situation.production);
    const dismissedIds = loadDismissed(projectPath);

    if (ephemeral) {
      set({
        suggestion: ephemeral,
        prevFingerprint: fp,
        dismissedIds,
      });
      return;
    }

    const ruleSuggestion = pickHermesOrbSuggestion({
      situation,
      failedTaskCount,
      prevFingerprint: get().prevFingerprint,
      dismissedIds,
      recentCanvasEvents: getCachedCanvasEvents(),
      nodes,
      edges,
    });

    if (seq !== refreshSeq) return;

    if (!ruleSuggestion || !shouldEnhanceOrbSuggestionWithLlm(ruleSuggestion.id)) {
      set({
        suggestion: ruleSuggestion,
        prevFingerprint: fp,
        dismissedIds,
      });
      return;
    }

    const cacheKey = `${ruleSuggestion.id}:${fp}`;
    const cached = llmEnhanceCache.get(cacheKey);
    if (cached) {
      set({
        suggestion: cached,
        prevFingerprint: fp,
        dismissedIds,
      });
      return;
    }

    set({
      suggestion: ruleSuggestion,
      prevFingerprint: fp,
      dismissedIds,
    });

    const enhanced = await enhanceOrbSuggestionWithLlm(
      ruleSuggestion,
      situation,
      projectPath,
    );
    if (seq !== refreshSeq) return;

    llmEnhanceCache.set(cacheKey, enhanced);
    trimLlmCache();
    set({
      suggestion: enhanced,
      prevFingerprint: fp,
      dismissedIds,
    });
  },

  dismissCurrent: () => {
    const { suggestion, ephemeralSuggestion } = get();
    const projectPath = useProjectStore.getState().projectPath?.trim();
    if (ephemeralSuggestion && suggestion?.id === ephemeralSuggestion.id) {
      set({ suggestion: null, ephemeralSuggestion: null });
      if (projectPath) void get().refreshAsync();
      return;
    }
    if (!suggestion || !projectPath) {
      set({ suggestion: null });
      return;
    }
    const next = new Set(get().dismissedIds);
    for (const id of expandProactiveDismissIds(suggestion.id)) next.add(id);
    saveDismissed(projectPath, next);
    set({ suggestion: null, dismissedIds: next });
  },

  reset: () => {
    refreshSeq += 1;
    if (refreshDebounceTimer) {
      clearTimeout(refreshDebounceTimer);
      refreshDebounceTimer = undefined;
    }
    llmEnhanceCache.clear();
    set({ suggestion: null, ephemeralSuggestion: null, prevFingerprint: null, dismissedIds: new Set() });
  },
}));
