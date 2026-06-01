import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { streamHermesChat } from "@/lib/hermes/hermesBrain";
import {
  buildHermesCanvasContext,
  formatPlanStepsForChat,
  proposeDirectorPlanAsync,
  type HermesDirectorPlan,
} from "@/lib/hermes/hermesDirector";
import { findPrimaryScriptNode } from "@/lib/hermes/hermesCanvasContext";
import {
  formatPlannerNoteForMixed,
  stripHermesChatBoilerplate,
} from "@/lib/hermes/hermesChatBrevity";
import {
  buildAgentLoopObserve,
  executeDirectorPlanWithAgentLoop,
  type AgentLoopLastToolResult,
} from "@/lib/hermes/agent/hermesAgentLoop";
import { shouldUseAgentLoop } from "@/lib/hermes/agent/hermesAgentSettings";
import {
  inferHermesReplyStyle,
  shouldStripHermesBoilerplate,
} from "@/lib/hermes/hermesReplyStyle";
import {
  formatRecoveryIntro,
  proposeFailureRecoveryPlan,
} from "@/lib/hermes/hermesFailureRecovery";
import {
  messageForAutoPipelineChatIntent,
  resolveAutoPipelineChatIntent,
} from "@/lib/hermes/hermesAutoPipelineChat";
import {
  clearPipelineCheckpoint,
  loadPipelineCheckpoint,
  savePipelineCheckpoint,
} from "@/lib/hermes/hermesPipelineCheckpoint";
import {
  formatBatchConfirmPrompt,
  isBatchCancelReply,
  isBatchConfirmReply,
  planNeedsBatchConfirmation,
} from "@/lib/hermes/hermesBatchConfirm";
import {
  clearPendingBatchPlan,
  loadPendingBatchPlan,
  savePendingBatchPlan,
} from "@/lib/hermes/hermesPendingBatch";
import { loadLastHermesPlan, saveLastHermesPlan } from "@/lib/hermes/hermesLastPlan";
import {
  resolveTemplateChatIntent,
  runTemplateChatAction,
} from "@/lib/hermes/hermesTemplateChat";
import {
  buildHermesMentionCatalog,
  formatHermesMentionsForLlm,
  imageRefPathsFromMentions,
  pinHermesMentionToRefStrip,
  resolveHermesMentionsFromCatalog,
  syncHermesRefStripFromMentionText,
  type HermesMentionItem,
} from "@/lib/hermes/hermesMentionCatalog";
import {
  HermesMentionInput,
  type HermesMentionInputRef,
} from "@/components/hermes/HermesMentionInput";
import {
  HermesRefAssetsStrip,
  useHermesRefAssets,
} from "@/components/hermes/HermesRefAssetsStrip";
import {
  resolveRefAssetsChatIntent,
  runRefAssetsChatAction,
} from "@/lib/hermes/hermesRefAssetsChat";
import { useProjectBibleStore } from "@/store/projectBibleStore";
import {
  buildHermesSituation,
  formatHermesSituationForLlm,
} from "@/lib/hermes/hermesSituation";
import {
  buildHermesProactiveSuggestions,
  expandProactiveDismissIds,
  filterSidebarProactiveChips,
  isProactiveSuggestionDismissed,
  proactiveSuggestionIdForGap,
} from "@/lib/hermes/hermesProactiveSuggestions";
import {
  filterGapsForSituationCard,
  shouldAutoActOrbSuggestion,
} from "@/lib/hermes/hermesProactivePolicy";
import { setPendingOrbPlanOrigin } from "@/lib/hermes/hermesOrbProactiveAct";
import { getCachedCanvasEvents } from "@/lib/hermes/agent/hermesCanvasEventCache";
import { countFailed } from "@/lib/hermes/hermesTaskTrack";
import { HermesProactiveChips } from "@/components/hermes/HermesProactiveChips";
import { HermesSituationCard } from "@/components/hermes/HermesSituationCard";
import { HermesContextStrip } from "@/components/hermes/HermesContextStrip";
import type { HermesChatMediaPreview } from "@/lib/hermes/hermesChatMediaPreview";
import { productionFingerprint } from "@/lib/hermes/hermesOrbSuggestions";
import { fetchHermesKnowledgeBlockForChat, fetchHermesKnowledgeBlockForSituation } from "@/lib/hermes/knowledge/hermesKnowledgeSearch";
import { formatHermesUserTip, saveHermesUserTip } from "@/lib/hermes/knowledge/hermesUserKnowledge";
import {
  parseHermesProfilePayload,
  parseHermesTeachPayload,
} from "@/lib/hermes/knowledge/hermesMemoryIntent";
import {
  buildSpiritFirstIntro,
  formatSpiritNameAck,
  formatUserHonorificAck,
  loadHermesSpiritIdentity,
  markSpiritIntroShown,
  parseSpiritNamePayload,
  parseUserHonorificPayload,
  resolveSpiritDisplayName,
  setSpiritName,
  setUserHonorific,
} from "@/lib/hermes/agent/hermesSpiritIdentity";
import { useHermesSpiritIdentityStore } from "@/store/hermesSpiritIdentityStore";
import {
  isModelApiConfigIntent,
  isModelApiConfigStatusIntent,
  messageForModelApiConfigChat,
} from "@/lib/hermes/agent/hermesModelApiConfig";
import {
  applyModelApiConfigFile,
  isModelApiConfigFileIntent,
  messageForModelApiConfigFileIntent,
  pickAndParseModelApiConfigFile,
  summarizeModelApiConfigFile,
  type ModelApiConfigFileParseResult,
} from "@/lib/hermes/agent/hermesModelApiConfigFile";
import { buildHermesAgentContextBlock } from "@/lib/hermes/agent/hermesAgentContext";
import {
  messageForHermesAgentChatIntent,
  resolveHermesAgentChatIntent,
} from "@/lib/hermes/agent/hermesAgentChat";
import {
  countScriptVersionsInStore,
} from "@/lib/hermes/agent/hermesScriptVersionAgent";
import {
  loadHermesScriptVersions,
  resolvePrimaryScriptNodeId,
} from "@/lib/hermes/agent/hermesScriptVersion";
import {
  canSubmitHermesMessage,
  hermesParallelStatusHint,
  isHermesProductionChannel,
} from "@/lib/hermes/agent/hermesParallelChannel";
import {
  clearPlanningMessageQueue,
  dequeuePlanningProductionMessage,
  enqueuePlanningProductionMessage,
  formatPlanningQueueAck,
  hermesPlanningQueueStatusHint,
  loadPlanningMessageQueue,
} from "@/lib/hermes/agent/hermesPlanningMessageQueue";
import {
  appendHermesMemoryFact,
  mergeHermesUserProfile,
} from "@/lib/hermes/agent/hermesPersistentMemory";
import {
  formatAwaitExecutePrompt,
  HERMES_AGENT_SETTINGS_UPDATED,
  refreshHermesAgentSettings,
  shouldAutoExecutePlans,
  shouldProactiveRecoveryAutoAct,
} from "@/lib/hermes/agent/hermesAgentSettings";
import {
  HERMES_ORB_AUTO_ACT_EVENT,
  type HermesOrbAutoActDetail,
} from "@/lib/hermes/hermesOrbProactiveAct";
import {
  buildDirectorJobQueueSnapshot,
  formatDirectorJobQueueForChat,
} from "@/lib/hermes/agent/hermesJobOrchestration";
import {
  countQueuedDirectorJobs,
  countRunningDirectorJobs,
  hasActiveDirectorJobs,
  HERMES_JOB_CANCELLED_ERROR,
  isDirectorJobCancelRequested,
  patchDirectorJobStep,
  registerDirectorPlanJobExecutor,
  syncDirectorJobStepList,
  hydrateHermesJobsForProject,
  titleForDirectorPlan,
  useHermesJobStore,
} from "@/lib/hermes/agent/hermesJobStore";
import {
  refreshHermesWorkstateCache,
  syncHermesWorkstateFromJobs,
} from "@/lib/hermes/agent/hermesWorkstate";
import {
  listAvoidSuggestionIds,
  recordAvoidProactiveSuggestion,
} from "@/lib/hermes/agent/hermesLearningAdaptation";
import { loadHermesPersistentMemory } from "@/lib/hermes/agent/hermesPersistentMemory";
import { reflectDirectorPlanJob } from "@/lib/hermes/agent/hermesJobReflection";
import {
  clearPendingExecutePlan,
  loadPendingExecutePlan,
  savePendingExecutePlan,
} from "@/lib/hermes/hermesPendingExecute";
import { useHermesAutomationRunner } from "@/hooks/useHermesAutomationRunner";
import { useHermesTaskStore } from "@/store/hermesTaskStore";
import { useHermesOrbSuggestStore } from "@/store/hermesOrbSuggestStore";
import {
  clearHermesChatHistory,
  loadHermesChatHistory,
  saveHermesChatHistory,
  type HermesChatMessage,
} from "@/lib/hermes/hermesChatHistory";
import {
  refreshHermesLongContext,
  trimChatHistoryForLlm,
} from "@/lib/hermes/agent/hermesLongContext";
import {
  messageForShellChatIntent,
  resolveShellChatIntent,
} from "@/lib/hermes/hermesShellChat";
import {
  resolveHermesMessageMode,
  shouldRunDirectorPlan,
} from "@/lib/hermes/hermesMessageIntent";
import { pickHermesLlmProvider } from "@/lib/hermes/pickHermesProvider";
import {
  addHermesSessionTokens,
  estimateTokensFromText,
} from "@/lib/hermes/hermesSessionUsage";
import { HermesFloatChatLines } from "@/components/hermes/HermesFloatChatLines";
import { HermesJobCenter } from "@/components/hermes/HermesJobCenter";
import { pushHermesJobToast } from "@/store/hermesJobToastStore";
import {
  formatHermesSelectionAckLine,
  pulseHermesHighlightForStep,
} from "@/lib/hermes/hermesCanvasHighlight";
import { useHermesCanvasHighlightStore } from "@/store/hermesCanvasHighlightStore";
import { IconComposerPlus, IconSendReturn } from "@/components/hermes/HermesWxIcons";
import { HermesComposerModelConfigActions } from "@/components/hermes/HermesComposerModelConfigActions";
import { HermesComposerUploadActions } from "@/components/hermes/HermesComposerUploadActions";
import {
  formatHermesComposerUploadAck,
  resolveHermesUploadScriptNodeId,
  type HermesComposerUploadPending,
} from "@/lib/hermes/hermesComposerUpload";
import {
  attachHermesComposerFileFromBlob,
  firstSupportedComposerPasteFile,
  pickAndAttachHermesComposerFile,
  type HermesComposerFileAttachResult,
} from "@/lib/hermes/hermesComposerFileAttach";
import { applyScriptDocumentImport } from "@/lib/scriptDocument/importScriptDocument";
import { HERMES_FLOAT_INPUT_PLACEHOLDER } from "@/lib/hermes/hermesFloatCopy";
import { DESKTOP_SHELL_HINT } from "@/lib/tauriEnv";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";
import { useHermesShellActivityStore } from "@/store/hermesShellActivityStore";
import { useHermesVoiceInput } from "@/hooks/useHermesVoiceInput";
import { useShallow } from "zustand/react/shallow";


type Props = {
  layout?: "float" | "sidebar";
};

function toDisplayLines(
  messages: HermesChatMessage[],
): Array<{ id: string; role: "user" | "hermes"; text: string; preview?: HermesChatMediaPreview }> {
  return messages.map((m) => ({
    id: m.id,
    role: m.role === "user" ? "user" : "hermes",
    text: m.content,
    preview: m.preview,
  }));
}

export function HermesSidebar({ layout = "float" }: Props) {
  const isFloat = layout === "float";
  const projectPath = useProjectStore((s) => s.projectPath);
  const spiritIdentity = useHermesSpiritIdentityStore(
    useShallow((s) => ({
      spiritName: s.spiritName,
      userHonorific: s.userHonorific,
      introShown: s.introShown,
    })),
  );
  const hydrateSpirit = useHermesSpiritIdentityStore((s) => s.hydrate);
  const applySpiritLocal = useHermesSpiritIdentityStore((s) => s.applyLocal);
  const spiritLabel = resolveSpiritDisplayName(spiritIdentity);
  const activeTabId = useCanvasUiStore((s) => s.activeTabId);
  const tabs = useCanvasUiStore(useShallow((s) => s.tabs));
  const canvasTabs = useMemo(
    () => tabs.map((t) => ({ id: t.id, name: t.name })),
    [tabs],
  );
  const activeTabName = useMemo(
    () => tabs.find((t) => t.id === activeTabId)?.name ?? null,
    [tabs, activeTabId],
  );
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const selectedNodeIds = useProjectStore((s) => s.selectedNodeIds);
  const selection = useMemo(
    () => ({
      count: selectedNodeIds.length,
      singleId: selectedNodeIds.length === 1 ? selectedNodeIds[0]! : null,
    }),
    [selectedNodeIds],
  );
  const selectionAck = useHermesCanvasHighlightStore((s) => s.selectionAck);
  const setSelectionAck = useHermesCanvasHighlightStore((s) => s.setSelectionAck);
  const prevSelectionKeyRef = useRef("");

  useEffect(() => {
    const key = [...selectedNodeIds].sort().join(",");
    if (key === prevSelectionKeyRef.current) return;
    prevSelectionKeyRef.current = key;
    if (!key) {
      setSelectionAck(null);
      return;
    }
    const line = formatHermesSelectionAckLine(nodes, selectedNodeIds);
    if (line) setSelectionAck(line);
  }, [nodes, selectedNodeIds, setSelectionAck]);

  const [messages, setMessages] = useState<HermesChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pendingUpload, setPendingUpload] = useState<HermesComposerUploadPending | null>(null);
  const [pendingModelConfig, setPendingModelConfig] =
    useState<ModelApiConfigFileParseResult | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [planningQueueTick, setPlanningQueueTick] = useState(0);
  const streaming = useHermesShellActivityStore((s) => s.streaming);
  const planning = useHermesShellActivityStore((s) => s.planning);
  const setStreaming = useHermesShellActivityStore((s) => s.setStreaming);
  const setPlanning = useHermesShellActivityStore((s) => s.setPlanning);
  const [tipBusy, setTipBusy] = useState(false);

  const [hermesRefs, setHermesRefs] = useHermesRefAssets(projectPath);
  const projectBible = useProjectBibleStore((s) => s.bible);
  const situation = useMemo(
    () =>
      buildHermesSituation(nodes, edges, projectPath, {
        selectedNodeIds,
        bible: projectBible,
      }),
    [nodes, edges, projectPath, selectedNodeIds, projectBible],
  );
  const situationCardGaps = useMemo(
    () => filterGapsForSituationCard(situation.gaps),
    [situation.gaps],
  );
  const situationForCard = useMemo(
    () => ({ ...situation, gaps: situationCardGaps }),
    [situation, situationCardGaps],
  );
  const situationForLlm = useMemo(
    () =>
      formatHermesSituationForLlm(situation, {
        includeCanvasEvents: false,
        includeReferentHint: false,
      }),
    [situation],
  );
  const hermesMentionCatalog = useMemo(
    () => buildHermesMentionCatalog(nodes, hermesRefs),
    [nodes, hermesRefs],
  );
  const hermesTasks = useHermesTaskStore((s) => s.tasks);
  const failedTaskCount = useMemo(() => countFailed(hermesTasks), [hermesTasks]);
  const directorJobsQueued = useHermesJobStore((s) =>
    countQueuedDirectorJobs(s.jobs, projectPath),
  );
  const proactiveDismissKey = projectPath
    ? `canvasflow.hermesProactiveDismissed.v1:${projectPath}`
    : null;
  const [proactiveDismissed, setProactiveDismissed] = useState<Set<string>>(
    () => new Set(),
  );
  useEffect(() => {
    if (!proactiveDismissKey || typeof sessionStorage === "undefined") {
      setProactiveDismissed(new Set());
      return;
    }
    try {
      const raw = sessionStorage.getItem(proactiveDismissKey);
      const arr = raw ? (JSON.parse(raw) as string[]) : [];
      setProactiveDismissed(new Set(Array.isArray(arr) ? arr : []));
    } catch {
      setProactiveDismissed(new Set());
    }
  }, [proactiveDismissKey]);
  const [scriptVersionCount, setScriptVersionCount] = useState(0);
  useEffect(() => {
    if (!projectPath) {
      setScriptVersionCount(0);
      return;
    }
    const scriptNodeId = resolvePrimaryScriptNodeId(nodes);
    if (!scriptNodeId) {
      setScriptVersionCount(0);
      return;
    }
    void loadHermesScriptVersions(projectPath).then((store) => {
      setScriptVersionCount(countScriptVersionsInStore(store, scriptNodeId));
    });
  }, [projectPath, nodes]);
  const pipelineCheckpoint = useMemo(
    () => (projectPath ? loadPipelineCheckpoint(projectPath) : null),
    [projectPath, nodes, edges],
  );
  const showSituationGaps =
    !isFloat && Boolean(projectPath) && situationCardGaps.length > 0;
  const [memoryAvoidIds, setMemoryAvoidIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const refreshMemoryAvoid = useCallback(async () => {
    if (!projectPath) {
      setMemoryAvoidIds(new Set());
      return;
    }
    const memory = await loadHermesPersistentMemory(projectPath);
    setMemoryAvoidIds(listAvoidSuggestionIds(memory));
  }, [projectPath]);
  useEffect(() => {
    void refreshMemoryAvoid();
  }, [refreshMemoryAvoid]);
  const proactiveDismissAll = useMemo(() => {
    const merged = new Set(proactiveDismissed);
    for (const id of memoryAvoidIds) {
      for (const alias of expandProactiveDismissIds(id)) merged.add(alias);
    }
    return merged;
  }, [proactiveDismissed, memoryAvoidIds]);
  const proactiveSuggestions = useMemo(() => {
    if (!projectPath) return [];
    const built = buildHermesProactiveSuggestions({
      situation,
      failedTaskCount,
      prevFingerprint: productionFingerprint(situation.production),
      recentCanvasEvents: getCachedCanvasEvents(),
      nodes,
      edges,
      pipelineCheckpoint,
      directorJobsQueued,
      scriptVersionCount,
      max: 4,
    }).filter((s) => !isProactiveSuggestionDismissed(s.id, proactiveDismissAll));
    return filterSidebarProactiveChips(built, situationCardGaps, showSituationGaps);
  }, [
    projectPath,
    situation,
    situationCardGaps,
    failedTaskCount,
    nodes,
    edges,
    pipelineCheckpoint,
    directorJobsQueued,
    scriptVersionCount,
    proactiveDismissAll,
    showSituationGaps,
  ]);
  const pendingProactiveIdRef = useRef<string | null>(null);
  const prefillComposer = useCallback((prompt: string, suggestionId?: string) => {
    const sid = suggestionId?.trim() || null;
    pendingProactiveIdRef.current = sid;
    if (sid && shouldAutoActOrbSuggestion(sid)) {
      setPendingOrbPlanOrigin(sid);
    }
    setDraft(prompt);
    requestAnimationFrame(() => composerRef.current?.focus());
  }, []);
  const appendComposer = useCallback((text: string) => {
    const t = text.trim();
    if (!t) return;
    setDraft((prev) => (prev.trim() ? `${prev.trimEnd()} ${t}` : t));
    requestAnimationFrame(() => composerRef.current?.focus());
  }, []);

  const pinMentionToRefStrip = useCallback(
    (item: HermesMentionItem) => {
      if (!projectPath) return;
      const next = pinHermesMentionToRefStrip(projectPath, item);
      if (next) setHermesRefs(next);
    },
    [projectPath, setHermesRefs],
  );

  const handleComposerChange = useCallback(
    (next: string) => {
      setDraft(next);
      if (!projectPath) return;
      const synced = syncHermesRefStripFromMentionText(
        projectPath,
        next,
        buildHermesMentionCatalog(nodes, hermesRefs),
      );
      if (synced) setHermesRefs(synced);
    },
    [projectPath, nodes, hermesRefs, setHermesRefs],
  );
  const [voiceInterim, setVoiceInterim] = useState("");
  const voiceInput = useHermesVoiceInput({
    disabled: streaming || tipBusy || planning,
    onAppendText: appendComposer,
    onInterimText: setVoiceInterim,
    onError: (msg) => setStatusText(msg),
  });
  const openScriptVersionDiff = useCanvasUiStore((s) => s.openScriptVersionDiff);
  const dismissProactive = useCallback(
    (id: string, message?: string) => {
      if (!proactiveDismissKey) return;
      if (projectPath) {
        void recordAvoidProactiveSuggestion(projectPath, id, message).then(() =>
          refreshMemoryAvoid(),
        );
      }
      const aliases = expandProactiveDismissIds(id);
      setProactiveDismissed((prev) => {
        const next = new Set(prev);
        for (const alias of aliases) next.add(alias);
        try {
          sessionStorage.setItem(
            proactiveDismissKey,
            JSON.stringify([...next].slice(-32)),
          );
        } catch {
          /* ignore */
        }
        return next;
      });
      const orb = useHermesOrbSuggestStore.getState().suggestion;
      if (orb && aliases.includes(orb.id)) {
        useHermesOrbSuggestStore.getState().dismissCurrent();
      }
    },
    [proactiveDismissKey, projectPath, refreshMemoryAvoid],
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HermesMentionInputRef>(null);
  const submitUserMessageRef = useRef<(raw: string) => void>(() => {});
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const chatGenerationRef = useRef(0);
  const hermesComposerSeed = useCanvasUiStore((s) => s.hermesComposerSeed);
  const setHermesComposerSeed = useCanvasUiStore((s) => s.setHermesComposerSeed);

  useEffect(() => {
    hydrateHermesJobsForProject(projectPath);
    setPendingUpload(null);
    clearPlanningMessageQueue(projectPath);
    setPlanningQueueTick((t) => t + 1);
  }, [projectPath]);

  useEffect(() => {
    void refreshHermesAgentSettings();
    const onAgentSettings = () => void refreshHermesAgentSettings();
    window.addEventListener(HERMES_AGENT_SETTINGS_UPDATED, onAgentSettings);
    window.addEventListener("canvasflow-settings-saved", onAgentSettings);
    return () => {
      window.removeEventListener(HERMES_AGENT_SETTINGS_UPDATED, onAgentSettings);
      window.removeEventListener("canvasflow-settings-saved", onAgentSettings);
    };
  }, []);

  useEffect(() => {
    if (!hermesComposerSeed?.trim()) return;
    setDraft(hermesComposerSeed);
    setHermesComposerSeed(null);
    requestAnimationFrame(() => composerRef.current?.focus());
  }, [hermesComposerSeed, setHermesComposerSeed]);

  const setDirectorSteps = useHermesTaskStore((s) => s.setDirectorSteps);
  const patchDirectorStep = useHermesTaskStore((s) => s.patchDirectorStep);
  const setChatTask = useHermesTaskStore((s) => s.setChatTask);
  const upsertPlanJob = useHermesTaskStore((s) => s.upsertPlanJob);
  const resetTasks = useHermesTaskStore((s) => s.reset);
  const directorJobsActive = useHermesJobStore((s) =>
    hasActiveDirectorJobs(s.jobs, projectPath),
  );
  const directorJobsRunning = useHermesJobStore((s) =>
    countRunningDirectorJobs(s.jobs, projectPath),
  );
  const parallelStatusHint = useMemo(
    () =>
      hermesParallelStatusHint({
        directorJobsRunning,
        directorJobsQueued,
        streaming,
        planning,
      }),
    [directorJobsRunning, directorJobsQueued, streaming, planning],
  );

  const planningMessageQueue = useMemo(
    () => (projectPath ? loadPlanningMessageQueue(projectPath) : []),
    [planningQueueTick, projectPath],
  );

  const planningQueueHint = useMemo(
    () => hermesPlanningQueueStatusHint(planningMessageQueue),
    [planningMessageQueue],
  );

  const flushPlanningMessageQueue = useCallback(() => {
    if (!projectPath) return;
    const next = dequeuePlanningProductionMessage(projectPath);
    setPlanningQueueTick((t) => t + 1);
    if (next?.text.trim()) {
      queueMicrotask(() => submitUserMessageRef.current(next.text.trim()));
    }
  }, [projectPath]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      resetTasks();
      if (projectPath) {
        useHermesJobStore.getState().resetProjectJobs(projectPath);
        await hydrateSpirit(projectPath);
      } else {
        await hydrateSpirit(null);
      }
      const loaded = loadHermesChatHistory(projectPath, activeTabId);
      if (projectPath && loaded.length === 0 && isTauri()) {
        const identity = await loadHermesSpiritIdentity(projectPath);
        if (!identity.introShown && !cancelled) {
          const introMsg: HermesChatMessage = {
            id: `spirit-intro-${Date.now()}`,
            role: "assistant",
            content: buildSpiritFirstIntro(identity),
          };
          setMessages([introMsg]);
          await markSpiritIntroShown(projectPath);
          applySpiritLocal({ introShown: true });
          return;
        }
      }
      if (!cancelled) setMessages(loaded);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTabId, applySpiritLocal, hydrateSpirit, projectPath, resetTasks]);

  useEffect(() => {
    void refreshHermesWorkstateCache(projectPath);
  }, [projectPath]);

  /** iter-62：切换 Tab 时将其它 Tab 增量对话并入工程级 digest */
  useEffect(() => {
    if (!projectPath || !isTauri()) return;
    const tabMessages = loadHermesChatHistory(projectPath, activeTabId);
    void refreshHermesLongContext(projectPath, {
      nodes: useProjectStore.getState().nodes,
      edges: useProjectStore.getState().edges,
      bible: useProjectBibleStore.getState().bible,
      chatMessages: tabMessages,
      activeTabId,
      canvasTabs: useCanvasUiStore.getState().tabs.map((t) => ({
        id: t.id,
        name: t.name,
      })),
    }).then(() => refreshHermesWorkstateCache(projectPath));
  }, [activeTabId, projectPath]);

  useEffect(() => {
    if (!projectPath) return;
    const sync = () => {
      void syncHermesWorkstateFromJobs(
        projectPath,
        useHermesJobStore.getState().jobs,
      ).then(() => refreshHermesWorkstateCache(projectPath));
    };
    sync();
    return useHermesJobStore.subscribe(sync);
  }, [projectPath]);

  useEffect(() => {
    const mapStatus = (
      status: "queued" | "running" | "done" | "failed" | "cancelled",
    ) => {
      if (status === "cancelled") return "failed" as const;
      return status;
    };
    const syncJobs = () => {
      const jobs = useHermesJobStore.getState().jobs.filter(
        (j) => j.projectPath === projectPath && j.kind === "director_plan",
      );
      for (const j of jobs) {
        const progress =
          j.progress && j.progress.total > 0
            ? Math.round((j.progress.done / j.progress.total) * 100)
            : j.status === "running"
              ? 20
              : undefined;
        upsertPlanJob(j.id, j.title, mapStatus(j.status), {
          progress,
          error: j.error,
        });
      }
    };
    syncJobs();
    return useHermesJobStore.subscribe(syncJobs);
  }, [projectPath, upsertPlanJob]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    saveHermesChatHistory(projectPath, messages, activeTabId);
  }, [messages, projectPath, activeTabId]);

  const persistAssistant = useCallback((assistantId: string, content: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === assistantId ? { ...m, content } : m)),
    );
  }, []);

  const runChat = useCallback(
    async (
      userText: string,
      refAppendix = "",
      chatOpts?: {
        advisorMode?: boolean;
        preamble?: string;
        messageMode?: ReturnType<typeof resolveHermesMessageMode>;
      },
    ) => {
      if (!isTauri()) {
        setStatusText(DESKTOP_SHELL_HINT);
        return;
      }
      const provider = await pickHermesLlmProvider();
      if (!provider) {
        setStatusText("请在设置 → 模型中启用对话服务商并配置 API Key");
        return;
      }
      const ts = Date.now();
      const userMsg: HermesChatMessage = { id: `u-${ts}`, role: "user", content: userText };
      const assistantId = `a-${ts}`;
      const assistantMsg: HermesChatMessage = { id: assistantId, role: "assistant", content: "" };
      const generation = ++chatGenerationRef.current;

      const historyBefore = messagesRef.current.filter((m) => m.id !== assistantId);

      if (projectPath) {
        await refreshHermesLongContext(projectPath, {
          nodes,
          edges,
          bible: useProjectBibleStore.getState().bible,
          chatMessages: historyBefore,
          activeTabId,
          canvasTabs,
        });
        await refreshHermesWorkstateCache(projectPath);
      }

      const { history: llmHistory } = trimChatHistoryForLlm(historyBefore);

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setStreaming(true);
      setChatTask(true);

      const requestId = crypto.randomUUID();
      let acc = "";
      let finalAssistant = "";

      try {
        const advisorMode = chatOpts?.advisorMode ?? false;
        const knowledgeFromMsg = await fetchHermesKnowledgeBlockForChat(userText, projectPath, {
          advisorMode,
        });
        const knowledgeFromCanvas = await fetchHermesKnowledgeBlockForSituation(
          situation,
          projectPath,
          userText,
        );
        const knowledgeBlock = [knowledgeFromCanvas, knowledgeFromMsg]
          .filter(Boolean)
          .join("")
          .slice(0, 3200);
        const agentBlock = await buildHermesAgentContextBlock(projectPath, userText);
        const preamble = chatOpts?.preamble?.trim();
        const situationSummary =
          situationForLlm +
          knowledgeBlock +
          (agentBlock ? `\n\n${agentBlock}` : "") +
          (preamble ? `\n\n【导演规划摘要】\n${preamble}` : "");
        const messageMode =
          chatOpts?.messageMode ?? resolveHermesMessageMode(userText);
        const replyStyle = inferHermesReplyStyle({
          userMessage: userText + refAppendix,
          messageMode,
          advisorMode,
        });
        const full = await streamHermesChat({
          requestId,
          nodes,
          edges,
          focusNodeId: selection.count === 1 ? selection.singleId : null,
          userMessage: userText + refAppendix,
          situationSummary,
          chatHistory: llmHistory,
          providerId: provider.providerId,
          model: provider.model,
          advisorMode,
          messageMode,
          replyStyle,
          handlers: {
            onToken: (token) => {
              if (generation !== chatGenerationRef.current) return;
              acc += token;
              persistAssistant(assistantId, acc);
            },
            onDone: (fullContent) => {
              if (generation !== chatGenerationRef.current) return;
              let text = (fullContent.trim() || acc).trim();
              if (shouldStripHermesBoilerplate(replyStyle)) {
                text = stripHermesChatBoilerplate(text);
              }
              finalAssistant = text;
              persistAssistant(assistantId, text);
            },
            onError: (error) => {
              if (generation !== chatGenerationRef.current) return;
              persistAssistant(assistantId, `请求失败：${error}`);
              setStatusText(`Hermes：${error}`);
            },
          },
        });
        if (full.trim() && full !== acc) {
          finalAssistant = full.trim();
          persistAssistant(assistantId, finalAssistant);
        }
        addHermesSessionTokens(
          projectPath,
          estimateTokensFromText(
            userText + refAppendix + (finalAssistant || acc),
          ),
        );
      } catch {
        /* onError 已写入气泡 */
      } finally {
        if (generation === chatGenerationRef.current) {
          setStreaming(false);
          setChatTask(false);
        }
      }
    },
    [
      edges,
      nodes,
      persistAssistant,
      projectPath,
      selection.count,
      selection.singleId,
      setChatTask,
      setStatusText,
      situationForLlm,
    ],
  );

  const appendProgressLine = useCallback((line: string, preview?: HermesChatMediaPreview) => {
    const id = `prog-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id, role: "assistant", content: line, preview },
    ]);
  }, []);

  const applyComposerAttachResult = useCallback(
    (result: HermesComposerFileAttachResult) => {
      if (result.kind === "model-config") {
        setPendingModelConfig(result.parsed);
        setMessages((prev) => [
          ...prev,
          {
            id: `model-config-ack-${Date.now()}`,
            role: "assistant",
            content: summarizeModelApiConfigFile(result.parsed),
          },
        ]);
        return;
      }
      if (!projectPath) {
        setStatusText("请先打开工程后再导入剧本");
        setMessages((prev) => [
          ...prev,
          {
            id: `upload-err-${Date.now()}`,
            role: "assistant",
            content: "剧本导入需要先打开工程。模型配置（.env / .json）无需工程，请重新选择配置文件。",
          },
        ]);
        return;
      }
      setPendingUpload({
        extract: result.extract,
        analysis: result.analysis,
      });
      const ack = formatHermesComposerUploadAck(result.extract, result.analysis);
      setMessages((prev) => [
        ...prev,
        { id: `upload-ack-${Date.now()}`, role: "assistant", content: ack },
      ]);
    },
    [projectPath, setStatusText],
  );

  const handleComposerAttachPick = useCallback(async () => {
    if (!isTauri()) {
      setStatusText(DESKTOP_SHELL_HINT);
      return;
    }
    if (streaming || tipBusy || planning || uploadBusy) return;

    setUploadBusy(true);
    try {
      const attached = await pickAndAttachHermesComposerFile();
      if (!attached) return;
      applyComposerAttachResult(attached);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusText(`读取文件失败：${msg}`);
    } finally {
      setUploadBusy(false);
    }
  }, [
    applyComposerAttachResult,
    planning,
    setStatusText,
    streaming,
    tipBusy,
    uploadBusy,
  ]);

  const handleComposerAttachPaste = useCallback(
    async (file: File) => {
      if (streaming || tipBusy || planning || uploadBusy) return;
      setUploadBusy(true);
      try {
        const attached = await attachHermesComposerFileFromBlob(file);
        applyComposerAttachResult(attached);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatusText(`粘贴文件失败：${msg}`);
      } finally {
        setUploadBusy(false);
      }
    },
    [applyComposerAttachResult, planning, setStatusText, streaming, tipBusy, uploadBusy],
  );

  const handleComposerPaste = useCallback(
    (e: ClipboardEvent<HTMLTextAreaElement>) => {
      const files = e.clipboardData?.files;
      if (!files?.length) return;
      const file = firstSupportedComposerPasteFile(files);
      if (!file) return;
      e.preventDefault();
      void handleComposerAttachPaste(file);
    },
    [handleComposerAttachPaste],
  );

  const applyComposerModelConfig = useCallback(async () => {
    if (!pendingModelConfig || pendingModelConfig.drafts.length === 0) return;
    setUploadBusy(true);
    try {
      const result = await applyModelApiConfigFile(pendingModelConfig.drafts);
      setMessages((prev) => [
        ...prev,
        {
          id: `model-config-done-${Date.now()}`,
          role: "assistant",
          content: result.message,
        },
      ]);
      if (result.ok) {
        setPendingModelConfig(null);
        window.dispatchEvent(new CustomEvent(HERMES_AGENT_SETTINGS_UPDATED));
      }
    } finally {
      setUploadBusy(false);
    }
  }, [pendingModelConfig]);

  const applyComposerUpload = useCallback(
    async (parseAfter: boolean) => {
      if (!pendingUpload || !projectPath) return;
      const scriptNodeId = resolveHermesUploadScriptNodeId(nodes);
      if (!scriptNodeId) {
        setMessages((prev) => [
          ...prev,
          {
            id: `upload-err-${Date.now()}`,
            role: "assistant",
            content: "请先在画布上创建脚本节点，再导入剧本。",
          },
        ]);
        return;
      }
      setUploadBusy(true);
      try {
        const result = await applyScriptDocumentImport({
          scriptNodeId,
          analysis: pendingUpload.analysis,
          parseAfter,
        });
        setStatusText(result.message);
        setMessages((prev) => [
          ...prev,
          {
            id: `upload-done-${Date.now()}`,
            role: "assistant",
            content: result.message,
          },
        ]);
        if (result.ok) setPendingUpload(null);
      } finally {
        setUploadBusy(false);
      }
    },
    [nodes, pendingUpload, projectPath, setStatusText],
  );

  const executePlanCore = useCallback(
    async (
      plan: HermesDirectorPlan,
      opts: {
        allowRecovery: boolean;
        checkpointBasePlan?: HermesDirectorPlan;
        jobId?: string;
      },
    ) => {
      let directorStepList = plan.steps.map((s) => ({ id: s.id, label: s.label }));
      setDirectorSteps(directorStepList);
      if (opts.jobId) {
        syncDirectorJobStepList(opts.jobId, directorStepList);
      }
      appendProgressLine(plan.isRecovery ? "开始自动修复…" : "开始执行…");

      const basePlan = opts.checkpointBasePlan ?? plan;
      const baseOffset =
        opts.checkpointBasePlan != null
          ? opts.checkpointBasePlan.steps.length - plan.steps.length
          : 0;
      let completedInBase = baseOffset;
      let lastToolResult: AgentLoopLastToolResult | undefined;
      const loopEnabled = shouldUseAgentLoop();

      const shouldAbort = opts.jobId
        ? () => isDirectorJobCancelRequested(opts.jobId!)
        : undefined;

      const { state: final, failedStep } = await executeDirectorPlanWithAgentLoop(
        plan,
        {
          shouldAbort,
          getObserve: () =>
            buildAgentLoopObserve(
              useProjectStore.getState().nodes,
              useProjectStore.getState().edges,
              projectPath,
              useProjectBibleStore.getState().bible,
              lastToolResult,
            ),
          onReplan: ({ steps, reason }) => {
            appendProgressLine(`↻ ${reason}`);
            directorStepList = [
              ...directorStepList,
              ...steps.map((s) => ({ id: s.id, label: s.label })),
            ];
            setDirectorSteps(directorStepList);
            if (opts.jobId) {
              syncDirectorJobStepList(opts.jobId, directorStepList);
            }
          },
          onLoopRound: (round, summary) => {
            if (!projectPath) return;
            void syncHermesWorkstateFromJobs(
              projectPath,
              useHermesJobStore.getState().jobs,
              { loopRound: round, lastToolSummary: summary },
            ).then(() => refreshHermesWorkstateCache(projectPath));
          },
          callbacks: {
            onStepStart: (step) => {
              pulseHermesHighlightForStep(step, {
                sourceMessage: plan.sourceMessage,
                scriptNodeId: findPrimaryScriptNode(useProjectStore.getState().nodes)?.id,
                nodes: useProjectStore.getState().nodes,
                edges: useProjectStore.getState().edges,
              });
              patchDirectorStep(step.id, "running");
              if (opts.jobId) {
                patchDirectorJobStep(
                  opts.jobId,
                  step.id,
                  "running",
                  directorStepList.map((s) => s.id),
                );
              }
              appendProgressLine(`▶ ${step.label}…`);
            },
            onStepEnd: (step, ok, message, preview) => {
              patchDirectorStep(
                step.id,
                ok ? "done" : "failed",
                ok ? undefined : message,
              );
              if (opts.jobId) {
                patchDirectorJobStep(
                  opts.jobId,
                  step.id,
                  ok ? "done" : "failed",
                  directorStepList.map((s) => s.id),
                );
              }
              appendProgressLine(
                ok ? `✓ ${step.label}：${message}` : `✗ ${step.label}：${message}`,
                preview,
              );
              lastToolResult = {
                ok,
                message,
                toolId: step.toolId,
                label: step.label,
              };
              if (ok && projectPath) {
                completedInBase += 1;
                savePipelineCheckpoint(projectPath, {
                  plan: basePlan,
                  completedStepCount: completedInBase,
                });
              }
            },
          },
        },
      );

      if (final.error === HERMES_JOB_CANCELLED_ERROR) {
        return final;
      }

      if (!final.error) {
        if (projectPath) clearPipelineCheckpoint(projectPath);
        if (projectPath) saveLastHermesPlan(projectPath, plan);
        return final;
      }

      if (
        opts.allowRecovery &&
        !loopEnabled &&
        !plan.isRecovery &&
        failedStep &&
        projectPath
      ) {
        const canvasCtx = buildHermesCanvasContext(
          useProjectStore.getState().nodes,
          projectPath,
        );
        const recovery = proposeFailureRecoveryPlan(
          {
            failedStep,
            errorMessage: final.error ?? "未知错误",
            parentPlan: plan,
          },
          canvasCtx,
        );
        if (recovery) {
          appendProgressLine(formatRecoveryIntro(recovery, failedStep));
          saveLastHermesPlan(projectPath, recovery);
          return executePlanCore(recovery, { allowRecovery: false });
        }
      }

      return final;
    },
    [appendProgressLine, patchDirectorStep, projectPath, setDirectorSteps],
  );

  const runPlanExecution = useCallback(
    (
      plan: HermesDirectorPlan,
      runOpts?: { checkpointBasePlan?: HermesDirectorPlan },
    ) => {
      if (!projectPath) return null;
      const wasActive = hasActiveDirectorJobs(
        useHermesJobStore.getState().jobs,
        projectPath,
      );
      const urgent = /优先执行|插队|队首|先跑这个/.test(
        plan.sourceMessage.trim(),
      );
      useHermesJobStore.getState().enqueueDirectorPlan(
        projectPath,
        {
          plan,
          checkpointBasePlan: runOpts?.checkpointBasePlan,
          allowRecovery: true,
        },
        undefined,
        urgent ? { enqueueAtFront: true, priority: "high" } : undefined,
      );
      void refreshHermesLongContext(projectPath, {
        nodes: useProjectStore.getState().nodes,
        edges: useProjectStore.getState().edges,
        bible: useProjectBibleStore.getState().bible,
        chatMessages: messagesRef.current,
        activeTabId,
        canvasTabs,
      })
        .then(() =>
          syncHermesWorkstateFromJobs(
            projectPath,
            useHermesJobStore.getState().jobs,
            { currentGoal: plan.sourceMessage.trim() || titleForDirectorPlan(plan) },
          ),
        )
        .then(() => refreshHermesWorkstateCache(projectPath));
      if (wasActive) {
        const snap = buildDirectorJobQueueSnapshot(
          useHermesJobStore.getState().jobs,
          projectPath,
        );
        pushHermesJobToast({
          kind: "info",
          message: snap
            ? `任务已入队（${formatDirectorJobQueueForChat(snap).split("\n")[0]}）`
            : "任务已加入队列，将在当前计划完成后按序执行。",
        });
      }
      return null;
    },
    [projectPath],
  );

  useEffect(() => {
    registerDirectorPlanJobExecutor(async (payload, jobId) => {
      const state = await executePlanCore(payload.plan, {
        allowRecovery: payload.allowRecovery ?? true,
        checkpointBasePlan: payload.checkpointBasePlan,
        jobId,
      });
      if (projectPath) {
        const title = titleForDirectorPlan(payload.plan);
        await syncHermesWorkstateFromJobs(
          projectPath,
          useHermesJobStore.getState().jobs,
          {
            lastError: state?.error ?? null,
            lastCompletedTitle: state?.error ? undefined : title,
            loopRound: null,
            lastToolSummary: null,
          },
        );
        await refreshHermesWorkstateCache(projectPath);
        const execState =
          state ??
          ({
            planId: payload.plan.id,
            stepStatuses: {},
            currentStepId: null,
            error: "执行未返回状态",
          } as const);
        const reflection = await reflectDirectorPlanJob(
          projectPath,
          payload.plan,
          execState,
        );
        if (reflection.wroteMemory || reflection.wroteLlmReflection) {
          if (reflection.wroteSkill) {
            appendProgressLine(
              "已自动记录本次成功经验（memory + Skill），下次类似任务会优先参考。",
            );
          } else if (reflection.wroteLlmReflection && reflection.llmInsight) {
            appendProgressLine(`已复盘：${reflection.llmInsight}`);
          } else if (reflection.memoryText?.includes("[recover:")) {
            appendProgressLine(
              "已记录本次恢复成功经验，下次类似失败会优先参考。",
            );
          } else if (reflection.wroteMemory) {
            appendProgressLine("已自动记录本次成功经验，下次类似任务会优先参考。");
          }
        }
      }
      return {
        state: state ?? {
          planId: payload.plan.id,
          stepStatuses: {},
          currentStepId: null,
          error: "执行未返回状态",
        },
        failedStep: null,
      };
    });
  }, [appendProgressLine, executePlanCore, projectPath]);

  const handleFormatUserTip = useCallback(
    async (raw: string) => {
      if (!projectPath?.trim()) {
        setStatusText("请先打开或保存工程，再贡献技巧");
        return;
      }
      if (!isTauri()) {
        setStatusText(DESKTOP_SHELL_HINT);
        return;
      }
      const provider = await pickHermesLlmProvider();
      if (!provider) {
        setStatusText("请在设置 → 模型中启用对话服务商并配置 API Key");
        return;
      }
      const ts = Date.now();
      const userMsg: HermesChatMessage = { id: `u-${ts}`, role: "user", content: raw };
      setMessages((prev) => [...prev, userMsg]);
      setTipBusy(true);
      try {
        const formatted = await formatHermesUserTip(raw, {
          providerId: provider.providerId,
          model: provider.model,
        });
        const { relPath, chunkCount } = await saveHermesUserTip(
          projectPath,
          formatted.markdown,
        );
        await appendHermesMemoryFact(projectPath, raw, "user");
        appendProgressLine(
          `已记住「${formatted.title}」（${relPath}，${chunkCount} 个检索片段；已写入工程长期记忆）。之后对话与执行会自动参考。`,
        );
        setStatusText("Hermes：已掌握本条经验");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        appendProgressLine(`整理失败：${msg}`);
        setStatusText(`Hermes：${msg}`);
      } finally {
        setTipBusy(false);
      }
    },
    [appendProgressLine, projectPath, setStatusText],
  );

  const submitUserMessage = useCallback(
    (raw: string) => {
    const text = raw.trim();
    if (!text || tipBusy) return;

    const ts = Date.now();
    const userMsg: HermesChatMessage = { id: `u-${ts}`, role: "user", content: text };

    const pendingExecute = loadPendingExecutePlan(projectPath);
    if (pendingExecute) {
      if (isBatchConfirmReply(text)) {
        clearPendingExecutePlan(projectPath);
        if (projectPath) saveLastHermesPlan(projectPath, pendingExecute);
        setMessages((prev) => [
          ...prev,
          userMsg,
          {
            id: `plan-${ts}`,
            role: "assistant",
            content: `${formatPlanStepsForChat(pendingExecute)}\n\n已确认，开始执行…`,
          },
        ]);
        void runPlanExecution(pendingExecute);
        return;
      }
      if (isBatchCancelReply(text)) {
        clearPendingExecutePlan(projectPath);
        setMessages((prev) => [
          ...prev,
          userMsg,
          { id: `cancel-${ts}`, role: "assistant", content: "已取消待执行计划。" },
        ]);
        return;
      }
      clearPendingExecutePlan(projectPath);
    }

    const pendingBatch = loadPendingBatchPlan(projectPath);
    if (pendingBatch) {
      if (isBatchConfirmReply(text)) {
        clearPendingBatchPlan(projectPath);
        const plan = pendingBatch.plan;
        if (projectPath) saveLastHermesPlan(projectPath, plan);
        const planChat = `${formatPlanStepsForChat(plan)}\n\n已确认，开始执行…`;
        setMessages((prev) => [
          ...prev,
          userMsg,
          { id: `plan-${ts}`, role: "assistant", content: planChat },
        ]);
        void runPlanExecution(plan);
        return;
      }
      if (isBatchCancelReply(text)) {
        clearPendingBatchPlan(projectPath);
        setMessages((prev) => [
          ...prev,
          userMsg,
          {
            id: `cancel-${ts}`,
            role: "assistant",
            content: "已取消本次批量任务。需要时重新说明即可。",
          },
        ]);
        return;
      }
      clearPendingBatchPlan(projectPath);
    }

    const agentChatIntent = resolveHermesAgentChatIntent(text);
    if (agentChatIntent) {
      void (async () => {
        const reply = await messageForHermesAgentChatIntent(
          agentChatIntent,
          text,
          projectPath,
        );
        setMessages((prev) => [
          ...prev,
          userMsg,
          { id: `agent-${ts}`, role: "assistant", content: reply.message },
        ]);
        if (reply.refreshPlanningQueue) {
          setPlanningQueueTick((t) => t + 1);
        }
        if (agentChatIntent === "compare_script_versions") {
          useCanvasUiStore.getState().openScriptVersionDiff();
        }
      })();
      return;
    }

    const autoPipelineIntent = resolveAutoPipelineChatIntent(text);
    if (autoPipelineIntent) {
      const result = messageForAutoPipelineChatIntent(autoPipelineIntent, projectPath);
      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: `auto-${ts}`, role: "assistant", content: result.message },
      ]);
      if (result.planToRun) {
        void runPlanExecution(result.planToRun, {
          checkpointBasePlan: loadPipelineCheckpoint(projectPath)?.plan,
        });
      }
      return;
    }

    const shellIntent = resolveShellChatIntent(text);
    if (shellIntent) {
      if (shellIntent === "clear_history") {
        clearHermesChatHistory(projectPath, activeTabId);
        clearPendingBatchPlan(projectPath);
        resetTasks();
        setMessages([
          {
            id: `shell-${ts}`,
            role: "assistant",
            content: messageForShellChatIntent("clear_history", {
              projectPath,
              tabName: activeTabName,
              cleared: true,
            }),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          userMsg,
          {
            id: `shell-${ts}`,
            role: "assistant",
            content: messageForShellChatIntent(shellIntent, {
              projectPath,
              tabName: activeTabName,
            }),
          },
        ]);
      }
      return;
    }

    if (isModelApiConfigFileIntent(text)) {
      void (async () => {
        const reply = await messageForModelApiConfigFileIntent(text, pickAndParseModelApiConfigFile);
        if (!reply.handled) return;
        if (reply.parsed) setPendingModelConfig(reply.parsed);
        setMessages((prev) => [
          ...prev,
          userMsg,
          { id: `model-config-${ts}`, role: "assistant", content: reply.message },
        ]);
      })();
      return;
    }

    if (isModelApiConfigIntent(text) || isModelApiConfigStatusIntent(text)) {
      void (async () => {
        const reply = await messageForModelApiConfigChat(text);
        if (!reply.handled) return;
        setMessages((prev) => [
          ...prev,
          userMsg,
          { id: `model-api-${ts}`, role: "assistant", content: reply.message },
        ]);
        if (reply.message.startsWith("已写入")) {
          window.dispatchEvent(new CustomEvent(HERMES_AGENT_SETTINGS_UPDATED));
        }
      })();
      return;
    }

    const refIntent = resolveRefAssetsChatIntent(text);
    if (refIntent) {
      void (async () => {
        setTipBusy(true);
        try {
          const result = await runRefAssetsChatAction(
            refIntent,
            text,
            projectPath,
            hermesRefs,
          );
          setHermesRefs(result.refs);
          setMessages((prev) => [
            ...prev,
            userMsg,
            { id: `ref-${ts}`, role: "assistant", content: result.message },
          ]);
          if (result.ok) {
            setStatusText("Hermes：参考素材已更新");
          }
        } finally {
          setTipBusy(false);
        }
      })();
      return;
    }

    const templateIntent = resolveTemplateChatIntent(text);
    if (templateIntent) {
      const lastPlan = projectPath ? loadLastHermesPlan(projectPath) : null;
      const result = runTemplateChatAction(templateIntent, text, lastPlan);
      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: `tpl-${ts}`, role: "assistant", content: result.message },
      ]);
      return;
    }

    const spiritNamePayload = parseSpiritNamePayload(text);
    if (spiritNamePayload !== null) {
      if (!projectPath?.trim()) {
        setStatusText("请先打开或保存工程");
        return;
      }
      if (spiritNamePayload.length < 1) {
        setStatusText("请告诉我灵体的名字（如「你叫小蓝」）");
        return;
      }
      setMessages((prev) => [...prev, userMsg]);
      void (async () => {
        await setSpiritName(projectPath, spiritNamePayload);
        applySpiritLocal({ spiritName: spiritNamePayload });
        appendProgressLine(formatSpiritNameAck(spiritNamePayload));
        setMessages((prev) => [
          ...prev,
          {
            id: `spirit-name-${ts}`,
            role: "assistant",
            content: formatSpiritNameAck(spiritNamePayload),
          },
        ]);
      })();
      return;
    }

    const honorificPayload = parseUserHonorificPayload(text);
    if (honorificPayload !== null) {
      if (!projectPath?.trim()) {
        setStatusText("请先打开或保存工程");
        return;
      }
      if (honorificPayload.length < 1) {
        setStatusText("请告诉我怎么称呼你（如「叫我老板」）");
        return;
      }
      setMessages((prev) => [...prev, userMsg]);
      void (async () => {
        await setUserHonorific(projectPath, honorificPayload);
        applySpiritLocal({ userHonorific: honorificPayload });
        appendProgressLine(formatUserHonorificAck(honorificPayload));
        setMessages((prev) => [
          ...prev,
          {
            id: `spirit-honorific-${ts}`,
            role: "assistant",
            content: formatUserHonorificAck(honorificPayload),
          },
        ]);
      })();
      return;
    }

    const profilePayload = parseHermesProfilePayload(text);
    if (profilePayload !== null) {
      if (profilePayload.length < 4) {
        setStatusText("请补充用户画像内容（可说「画像：…」）");
        return;
      }
      if (!projectPath?.trim()) {
        setStatusText("请先打开或保存工程");
        return;
      }
      setMessages((prev) => [...prev, userMsg]);
      void (async () => {
        await mergeHermesUserProfile(projectPath, profilePayload);
        await appendHermesMemoryFact(
          projectPath,
          `[pref:] ${profilePayload}`,
          "user",
        );
        appendProgressLine(`已更新用户画像：${profilePayload.slice(0, 80)}`);
        setStatusText("Hermes：画像已写入长期记忆");
      })();
      return;
    }

    const teachPayload = parseHermesTeachPayload(text);
    if (teachPayload !== null) {
      if (teachPayload.length < 6) {
        setStatusText("请补充要记住的具体内容（可说「记住：…」）");
        return;
      }
      void handleFormatUserTip(teachPayload);
      return;
    }

    const mentioned = resolveHermesMentionsFromCatalog(text, hermesMentionCatalog);
    const refPaths = imageRefPathsFromMentions(mentioned);
    const refAppendix = formatHermesMentionsForLlm(mentioned);
    const messageMode = resolveHermesMessageMode(text);

    if (planning && isHermesProductionChannel(messageMode)) {
      if (!projectPath) {
        setStatusText("请先打开工程");
        return;
      }
      const queued = enqueuePlanningProductionMessage(projectPath, text);
      if (!queued.ok) {
        setStatusText(queued.reason);
        return;
      }
      setMessages((prev) => [
        ...prev,
        userMsg,
        ...(queued.duplicate
          ? []
          : [
              {
                id: `plan-queue-${ts}`,
                role: "assistant" as const,
                content: formatPlanningQueueAck(text, queued.position),
              },
            ]),
      ]);
      if (queued.duplicate) {
        setStatusText("该指令已在规划队列中");
      }
      setPlanningQueueTick((t) => t + 1);
      return;
    }

    if (!canSubmitHermesMessage({ messageMode, streaming, planning })) {
      return;
    }

    if (!shouldRunDirectorPlan(messageMode)) {
      void runChat(text, refAppendix, { advisorMode: true });
      return;
    }

    void (async () => {
      setPlanning(true);
      let plan: HermesDirectorPlan | null = null;
      try {
        if (projectPath) {
          await refreshHermesLongContext(projectPath, {
            nodes,
            edges,
            bible: useProjectBibleStore.getState().bible,
            chatMessages: messagesRef.current,
            activeTabId,
            canvasTabs,
          });
          await refreshHermesWorkstateCache(projectPath);
        }
        plan = await proposeDirectorPlanAsync(text, nodes, edges, projectPath, {
          referenceRelPaths: refPaths,
          messageMode,
        });
      } finally {
        setPlanning(false);
        flushPlanningMessageQueue();
      }

      const blockedSummarize =
        plan?.steps.length === 1 &&
        plan.steps[0]?.toolId === "canvas.summarize" &&
        plan.steps[0]!.label.includes("请先打开");

      if (blockedSummarize) {
        setMessages((prev) => [
          ...prev,
          userMsg,
          { id: `warn-${ts}`, role: "assistant", content: plan!.steps[0]!.label },
        ]);
        return;
      }

      if (plan && plan.steps.length > 0) {
        const ctx = buildHermesCanvasContext(nodes, projectPath);
        const batch = planNeedsBatchConfirmation(plan, ctx, { userMessage: text });
        if (batch.needed && projectPath) {
          savePendingBatchPlan(projectPath, plan, batch.beatCount);
          const planChat = `${formatPlanStepsForChat(plan, { messageMode })}\n\n${formatBatchConfirmPrompt(batch.beatCount, batch.labels)}`;
          setMessages((prev) => [
            ...prev,
            userMsg,
            { id: `plan-${ts}`, role: "assistant", content: planChat },
          ]);
          return;
        }
        if (projectPath) saveLastHermesPlan(projectPath, plan);
        const plannerNote =
          messageMode === "mixed" && plan.plannerReply?.trim()
            ? formatPlannerNoteForMixed(plan.plannerReply, {
                userMessage: text,
                messageMode,
                planStepCount: plan.steps.length,
              })
            : "";
        const planFmt = { messageMode };
        if (!shouldAutoExecutePlans()) {
          if (projectPath) {
            savePendingExecutePlan(projectPath, plan);
          }
          const planChat = `${plannerNote}${formatPlanStepsForChat(plan, planFmt)}\n\n${formatAwaitExecutePrompt()}`;
          setMessages((prev) => [
            ...prev,
            userMsg,
            { id: `plan-${ts}`, role: "assistant", content: planChat },
          ]);
          return;
        }
        const autoNote = plan.templateId === "full-auto-export"
          ? "\n\n全自动跑片：大批量步骤默认免「继续」确认；失败可说「继续跑片」续跑。"
          : "";
        const queueNote =
          directorJobsActive && directorJobsRunning > 0
            ? "\n\n当前有任务执行中，本计划已加入队列。"
            : "";
        const planChat = `${plannerNote}${formatPlanStepsForChat(plan, planFmt)}\n\n将自动执行。${autoNote}${queueNote}`;
        setMessages((prev) => [
          ...prev,
          userMsg,
          { id: `plan-${ts}`, role: "assistant", content: planChat },
        ]);
        if (projectPath) {
          clearPipelineCheckpoint(projectPath);
        }
        void runPlanExecution(plan);
        return;
      }

      const advisorFallback =
        messageMode === "consult" || messageMode === "mixed";
      void runChat(text, refAppendix, {
        advisorMode: advisorFallback,
        preamble: plan?.plannerReply,
        messageMode,
      });
    })();
  },
  [
    edges,
    activeTabId,
    activeTabName,
    directorJobsActive,
    directorJobsRunning,
    handleFormatUserTip,
    hermesRefs,
    setHermesRefs,
    hermesMentionCatalog,
    nodes,
    resetTasks,
    planning,
    projectPath,
    runChat,
    runPlanExecution,
    streaming,
    tipBusy,
    flushPlanningMessageQueue,
    appendProgressLine,
    setStatusText,
  ],
  );

  submitUserMessageRef.current = submitUserMessage;
  const expandHermes = useCanvasUiStore((s) => s.expandHermes);

  useEffect(() => {
    const onOrbAutoAct = (e: Event) => {
      const detail = (e as CustomEvent<HermesOrbAutoActDetail>).detail;
      if (!detail?.prompt?.trim()) return;
      if (!shouldProactiveRecoveryAutoAct()) return;
      const mode = resolveHermesMessageMode(detail.prompt);
      if (!canSubmitHermesMessage({ messageMode: mode, streaming, planning })) return;
      expandHermes();
      submitUserMessageRef.current(detail.prompt.trim());
    };
    window.addEventListener(HERMES_ORB_AUTO_ACT_EVENT, onOrbAutoAct);
    return () => window.removeEventListener(HERMES_ORB_AUTO_ACT_EVENT, onOrbAutoAct);
  }, [expandHermes, planning, streaming]);

  useHermesAutomationRunner(projectPath, (prompt) => {
    const t = prompt.trim();
    if (!t || tipBusy) return;
    const mode = resolveHermesMessageMode(t);
    if (!canSubmitHermesMessage({ messageMode: mode, streaming, planning })) return;
    submitUserMessageRef.current(t);
  });

  const handleSend = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    const pendingId = pendingProactiveIdRef.current;
    pendingProactiveIdRef.current = null;
    setDraft("");
    if (pendingId) dismissProactive(pendingId);
    submitUserMessage(text);
  }, [draft, submitUserMessage, dismissProactive]);

  const lines = toDisplayLines(messages);

  const showFloatToolsDrawer = isFloat && Boolean(projectPath);

  const composerStatus =
    planning ||
    streaming ||
    directorJobsActive ||
    voiceInput.isListening ||
    voiceInput.isBusy ||
    planningQueueHint ? (
      <p className="hermesFloatComposerStatus" role="status">
        {voiceInput.isBusy
          ? "语音识别中…"
          : voiceInput.isListening
            ? voiceInterim
              ? `正在听：${voiceInterim}`
              : voiceInput.backend === "whisper"
                ? "录音中…"
                : "正在听…"
            : parallelStatusHint
              ? parallelStatusHint
              : planning && planningQueueHint
                ? `正在规划… · ${planningQueueHint}`
                : planning
                  ? "正在规划…"
                  : planningQueueHint
                    ? planningQueueHint
                    : directorJobsActive
                      ? directorJobsRunning > 0
                        ? `执行中…${directorJobsQueued > 0 ? `（${directorJobsQueued} 排队）` : ""}`
                        : `${directorJobsQueued} 个排队…`
                      : "生成中…"}
      </p>
    ) : selectionAck ? (
      <p className="hermesFloatComposerStatus hermesSelectionAck" role="status">
        {selectionAck}
      </p>
    ) : null;

  const composerTools = (
    <>
      {!isFloat && projectPath && situationCardGaps.length > 0 ? (
        <HermesSituationCard
          situation={situationForCard}
          disabled={streaming || tipBusy || planning}
          onGapAction={(prompt, gapId) =>
            prefillComposer(prompt, proactiveSuggestionIdForGap(gapId))
          }
        />
      ) : null}
      {proactiveSuggestions.length > 0 ? (
        <HermesProactiveChips
          suggestions={proactiveSuggestions.slice(0, 4)}
          disabled={streaming || tipBusy || planning}
          onApply={(prompt, suggestionId) => prefillComposer(prompt, suggestionId)}
          onDismiss={dismissProactive}
        />
      ) : null}
      {projectPath ? (
        <button
          type="button"
          className="hermesFloatVersionDiffLink"
          disabled={streaming || tipBusy || planning}
          onClick={() => openScriptVersionDiff()}
        >
          版本对比
        </button>
      ) : null}
      {projectPath ? (
        <HermesRefAssetsStrip
          refs={hermesRefs}
          onRefsChange={setHermesRefs}
          disabled={tipBusy || streaming || planning}
          onInsertMention={(name) => {
            const token = name.startsWith("@") ? name : `@${name}`;
            composerRef.current?.insertAtToken(token);
          }}
        />
      ) : null}
    </>
  );

  const panelClass = isFloat ? "hermesPanel hermesPanel--float" : "hermesSidebar hermesSidebar--chatOnly";
  const PanelTag = isFloat ? "div" : "aside";

  return (
    <PanelTag
      className={panelClass}
      aria-label={isFloat ? `${spiritLabel} 对话` : `${spiritLabel} 灵体`}
    >
      <div className="hermesWxChat" ref={scrollRef}>
        <HermesFloatChatLines
          lines={lines}
          streaming={streaming}
          variant={isFloat ? "float" : "sidebar"}
        />
      </div>

      {!isFloat ? <HermesJobCenter projectPath={projectPath} variant="sidebar" /> : null}

      <footer className={`hermesFloatComposer${isFloat ? " hermesFloatComposer--lite" : ""}`}>
        {isFloat ? (
          showFloatToolsDrawer ? (
            <details className="hermesFloatExtras">
              <summary className="hermesFloatExtrasSummary">
                工具
                {hermesRefs.length > 0 ? ` · ${hermesRefs.length} 参考` : ""}
                {situationCardGaps.length > 0 ? ` · ${situationCardGaps.length} 待办` : ""}
                {proactiveSuggestions.length > 0 ? ` · ${proactiveSuggestions.length} 建议` : ""}
              </summary>
              <div className="hermesFloatExtrasBody">{composerTools}</div>
            </details>
          ) : null
        ) : (
          composerTools
        )}
        {isFloat && projectPath ? <HermesContextStrip situation={situation} /> : null}
        {pendingModelConfig ? (
          <HermesComposerModelConfigActions
            pending={pendingModelConfig}
            disabled={streaming || tipBusy || planning || uploadBusy}
            onImport={() => void applyComposerModelConfig()}
            onDismiss={() => setPendingModelConfig(null)}
          />
        ) : null}
        {pendingUpload ? (
          <HermesComposerUploadActions
            pending={pendingUpload}
            disabled={streaming || tipBusy || planning || uploadBusy}
            onWriteOnly={() => void applyComposerUpload(false)}
            onWriteAndParse={() => void applyComposerUpload(true)}
            onDismiss={() => setPendingUpload(null)}
          />
        ) : null}
        {composerStatus}
        <div className="hermesFloatInputPill hermesFloatInputPill--unified">
          {isTauri() ? (
            <button
              type="button"
              className="hermesFloatInputAttachBtn"
              aria-label="添加文件"
              title="上传剧本（txt / md / docx）或模型配置（.env / .json）"
              disabled={streaming || tipBusy || planning || uploadBusy}
              onClick={() => void handleComposerAttachPick()}
            >
              <IconComposerPlus />
            </button>
          ) : null}
          <div className="hermesFloatInputBody">
            <HermesMentionInput
              ref={composerRef}
              rows={isFloat ? 1 : 2}
              placeholder={HERMES_FLOAT_INPUT_PLACEHOLDER}
              value={draft}
              nodes={nodes}
              pinnedRefs={hermesRefs}
              disabled={tipBusy}
              onChange={handleComposerChange}
              onPinMention={pinMentionToRefStrip}
              onPaste={handleComposerPaste}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.defaultPrevented) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
          </div>
          <button
            type="button"
            className={`hermesFloatInputSendBtn${draft.trim() ? " hermesFloatInputSendBtn--active" : ""}`}
            disabled={!draft.trim() || tipBusy}
            aria-label="发送"
            onClick={handleSend}
          >
            <IconSendReturn />
          </button>
        </div>
      </footer>
    </PanelTag>
  );
}
