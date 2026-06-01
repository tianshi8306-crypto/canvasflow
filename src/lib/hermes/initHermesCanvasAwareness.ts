import {
  buildGraphFingerprint,
  buildMediaFingerprint,
  buildScriptBriefFingerprint,
  buildScriptSnapshot,
  detectCanvasEvents,
  type HermesScriptSnapshot,
} from "@/lib/hermes/agent/hermesCanvasEvents";
import {
  ingestCanvasEvents,
  persistStyleAnchor,
  refreshCanvasEventsCache,
  resetCanvasEventsCache,
} from "@/lib/hermes/agent/hermesCanvasEventCache";
import { styleAnchorFromBible } from "@/lib/hermes/agent/hermesStyleReferent";
import { refreshHermesLongContext } from "@/lib/hermes/agent/hermesLongContext";
import { refreshHermesWorkstateCache } from "@/lib/hermes/agent/hermesWorkstate";
import { buildHermesSituation } from "@/lib/hermes/hermesSituation";
import { productionFingerprint } from "@/lib/hermes/hermesOrbSuggestions";
import { useHermesOrbSuggestStore } from "@/store/hermesOrbSuggestStore";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectBibleStore } from "@/store/projectBibleStore";
import { useProjectStore } from "@/store/projectStore";

let attached = false;
let prevScript: HermesScriptSnapshot | null = null;
let prevSelectionId: string | null = null;
let prevBibleChars = 0;
let prevProductionFp: string | null = null;
let prevMediaFp: string | null = null;
let prevGraphFp: string | null = null;
let prevBriefFp: string | null = null;
let trackedProjectPath: string | null = null;
let workstateRefreshTimer: ReturnType<typeof setTimeout> | null = null;

function resetTrackers(): void {
  prevScript = null;
  prevSelectionId = null;
  prevBibleChars = 0;
  prevProductionFp = null;
  prevMediaFp = null;
  prevGraphFp = null;
  prevBriefFp = null;
  if (workstateRefreshTimer) {
    clearTimeout(workstateRefreshTimer);
    workstateRefreshTimer = null;
  }
}

function scheduleWorkstateRefresh(projectPath: string): void {
  if (workstateRefreshTimer) clearTimeout(workstateRefreshTimer);
  workstateRefreshTimer = setTimeout(() => {
    workstateRefreshTimer = null;
    void refreshHermesWorkstateCache(projectPath);
  }, 280);
}

function seedTrackers(projectPath: string): void {
  const nodes = useProjectStore.getState().nodes;
  const edges = useProjectStore.getState().edges;
  const selectedNodeIds = useProjectStore.getState().selectedNodeIds;
  const bible = useProjectBibleStore.getState().bible;
  prevScript = buildScriptSnapshot(nodes);
  prevSelectionId =
    selectedNodeIds.length === 1 ? selectedNodeIds[0]! : null;
  prevBibleChars = bible?.characters.length ?? 0;
  const situation = buildHermesSituation(nodes, edges, projectPath, {
    selectedNodeIds,
    bible,
  });
  prevProductionFp = productionFingerprint(situation.production);
  prevMediaFp = buildMediaFingerprint(nodes);
  prevGraphFp = buildGraphFingerprint(nodes, edges);
  prevBriefFp = buildScriptBriefFingerprint(nodes);
}

/**
 * 订阅画布/圣经/选中变化，写入 workstate 近期事件并刷新 Orb 建议。
 */
export function initHermesCanvasAwareness(): void {
  if (attached || typeof window === "undefined") return;
  attached = true;

  const runDetect = () => {
    const projectPath = useProjectStore.getState().projectPath?.trim() ?? null;

    if (!projectPath) {
      trackedProjectPath = null;
      resetTrackers();
      resetCanvasEventsCache();
      useHermesOrbSuggestStore.getState().reset();
      return;
    }

    if (projectPath !== trackedProjectPath) {
      trackedProjectPath = projectPath;
      resetTrackers();
      seedTrackers(projectPath);
      void refreshCanvasEventsCache(projectPath).then(() => {
        useHermesOrbSuggestStore.getState().refresh();
      });
      return;
    }

    const nodes = useProjectStore.getState().nodes;
    const edges = useProjectStore.getState().edges;
    const selectedNodeIds = useProjectStore.getState().selectedNodeIds;
    const bible = useProjectBibleStore.getState().bible;

    const { events, scriptSnapshot } = detectCanvasEvents({
      nodes,
      edges,
      projectPath,
      selectedNodeIds,
      bible,
      prevScriptSnapshot: prevScript,
      prevSelectionNodeId: prevSelectionId,
      prevBibleCharCount: prevBibleChars,
      prevProductionFp,
      prevMediaFp,
      prevGraphFp,
      prevBriefFp,
    });

    if (selectedNodeIds.length === 1) {
      prevSelectionId = selectedNodeIds[0]!;
    } else if (selectedNodeIds.length === 0) {
      prevSelectionId = null;
    }

    prevBibleChars = bible?.characters.length ?? 0;
    if (scriptSnapshot) {
      prevScript = scriptSnapshot;
      const situation = buildHermesSituation(nodes, edges, projectPath, {
        selectedNodeIds,
        bible,
      });
      prevProductionFp = productionFingerprint(situation.production);
    }
    const nextMediaFp = buildMediaFingerprint(nodes);
    if (nextMediaFp !== prevMediaFp) {
      prevMediaFp = nextMediaFp;
    }
    const nextGraphFp = buildGraphFingerprint(nodes, edges);
    if (nextGraphFp !== prevGraphFp) {
      prevGraphFp = nextGraphFp;
    }
    const nextBriefFp = buildScriptBriefFingerprint(nodes);
    if (nextBriefFp !== prevBriefFp) {
      prevBriefFp = nextBriefFp;
    }

    void (async () => {
      if (events.length > 0) {
        await ingestCanvasEvents(projectPath, events);
        if (events.some((e) => e.kind === "bible_updated")) {
          const bibleAnchor = styleAnchorFromBible(bible);
          if (bibleAnchor) await persistStyleAnchor(projectPath, bibleAnchor);
        }
        scheduleWorkstateRefresh(projectPath);
      }
      const scriptChanged = events.some(
        (e) =>
          e.kind === "storyboard_edited" ||
          e.kind === "production_shift" ||
          e.kind === "bible_updated" ||
          e.kind === "beats_changed" ||
          e.kind === "brief_updated" ||
          e.kind === "graph_changed",
      );
      if (scriptChanged) {
        const ui = useCanvasUiStore.getState();
        await refreshHermesLongContext(projectPath, {
          nodes,
          edges,
          bible,
          activeTabId: ui.activeTabId,
          canvasTabs: ui.tabs.map((t) => ({ id: t.id, name: t.name })),
        });
        await refreshHermesWorkstateCache(projectPath);
      }
      useHermesOrbSuggestStore.getState().refresh();
    })();
  };

  useProjectStore.subscribe((state, prev) => {
    if (
      state.nodes !== prev.nodes ||
      state.edges !== prev.edges ||
      state.selectedNodeIds !== prev.selectedNodeIds ||
      state.projectPath !== prev.projectPath
    ) {
      runDetect();
    }
  });

  useProjectBibleStore.subscribe((state, prev) => {
    if (state.bible !== prev.bible) runDetect();
  });
}
