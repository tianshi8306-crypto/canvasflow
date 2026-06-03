import { isTauri } from "@tauri-apps/api/core";
import { appendNodeAgentEvent } from "@/shared/api/runs";
import { useEffect, useState } from "react";
import { FlowCanvas } from "@/components/FlowCanvas";
import { AppTopBar } from "@/components/AppTopBar";
import { SettingsPanel } from "@/components/SettingsPanel";
import { ScriptNodeFullscreenOverlay } from "@/components/ScriptNodeFullscreenOverlay";
import { ComposeEditorOverlay } from "@/components/compose/ComposeEditorOverlay";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { HermesScriptVersionDiffOverlay } from "@/components/hermes/HermesScriptVersionDiffOverlay";
import type { NodeAgentRuntimeEvent } from "@/lib/nodeAgentRuntime/types";
import { isCanvasShortcutBlockedTarget, useCanvasShortcutActions } from "@/hooks/canvas/useCanvasShortcutActions";
import { nudgeDeltaFromArrowKey } from "@/lib/nodeCanvasNudge";
import { bindActiveTabToProject } from "@/lib/canvasTabSync";
import { useProjectStore } from "@/store/projectStore";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { HermesOrbSuggestionBridge } from "@/components/hermes/HermesOrbSuggestionBridge";
import { AppUpdateDialog } from "@/components/AppUpdateDialog";
import { useAppUpdateAtStartup } from "@/hooks/useAppUpdateAtStartup";
import { initHermesAutoChain, syncCanvasMcpBridgeContext } from "@/lib/hermes";
import "@/styles/hermes-shell.css";
import {
  isPassiveAudioAsset,
  AUDIO_PASSIVE_REFERENCE_STATUS,
} from "@/lib/audioNodeContainerMode";
import {
  isPassiveTextContainer,
  TEXT_PASSIVE_CONTAINER_STATUS,
} from "@/lib/textNodeContainerMode";
import { useNodeStatusListener } from "@/hooks/useNodeStatus";
import { useProjectAutoSaveSettingsSync } from "@/hooks/useProjectAutoSaveSettingsSync";
import { useCanvasSettingsSync } from "@/hooks/useCanvasSettingsSync";
import type { SettingsCategory } from "@/components/SettingsNav";

type OpenSettingsDetail = {
  category?: SettingsCategory;
  focusSectionId?: string;
};

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsOpenRequest, setSettingsOpenRequest] = useState<{
    category: SettingsCategory | null;
    focusSectionId: string | null;
    nonce: number;
  }>({ category: null, focusSectionId: null, nonce: 0 });
  useProjectAutoSaveSettingsSync();
  useCanvasSettingsSync();

  const scriptFullscreenNodeId = useProjectStore((s) => s.scriptFullscreenNodeId);
  const composeEditorNodeId = useCanvasUiStore((s) => s.composeEditorNodeId);
  const projectPath = useProjectStore((s) => s.projectPath);
  const lastRunId = useProjectStore((s) => s.lastRunId);
  const setLastRunId = useProjectStore((s) => s.setLastRunId);
  const groupSelectedNodes = useProjectStore((s) => s.groupSelectedNodes);
  const ungroupSelectedNodes = useProjectStore((s) => s.ungroupSelectedNodes);
  const copySelection = useProjectStore((s) => s.copySelection);
  const pasteSelection = useProjectStore((s) => s.pasteSelection);
  const deleteSelection = useProjectStore((s) => s.deleteSelection);
  const nudgeSelectedNodes = useProjectStore((s) => s.nudgeSelectedNodes);
  const newProject = useProjectStore((s) => s.newProject);
  const openProject = useProjectStore((s) => s.openProject);
  const saveProject = useProjectStore((s) => s.saveProject);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const {
    duplicateSelection,
    runGenerateShortcut,
    openAddPanelCenter,
    toggleShortcutsOverlay,
  } = useCanvasShortcutActions();
  const setTextGenPanelPinnedNodeId = useCanvasUiStore((s) => s.setTextGenPanelPinnedNodeId);
  const setAudioTtsPanelPinnedNodeId = useCanvasUiStore((s) => s.setAudioTtsPanelPinnedNodeId);
  const setAudioTtsPanelNodeId = useCanvasUiStore((s) => s.setAudioTtsPanelNodeId);
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const toggleHermes = useCanvasUiStore((s) => s.toggleHermes);
  const collapseHermes = useCanvasUiStore((s) => s.collapseHermes);
  const hermesMode = useCanvasUiStore((s) => s.hermesMode);
  const hermesJobDrawerOpen = useCanvasUiStore((s) => s.hermesJobDrawerOpen);
  const closeHermesJobDrawer = useCanvasUiStore((s) => s.closeHermesJobDrawer);
  const confirmDialog = useCanvasUiStore((s) => s.confirmDialog);
  const { pendingUpdate, dismissPendingUpdate } = useAppUpdateAtStartup();

  useEffect(() => {
    const onKeydown = (ev: KeyboardEvent) => {
      const shouldBlockCanvasShortcut = isCanvasShortcutBlockedTarget(ev.target);
      const mod = ev.ctrlKey || ev.metaKey;
      const key = ev.key.toLowerCase();

      if (ev.key === "?" && !shouldBlockCanvasShortcut) {
        ev.preventDefault();
        toggleShortcutsOverlay();
        return;
      }

      const nudgeDelta = nudgeDeltaFromArrowKey(ev.key, ev.shiftKey);
      if (
        nudgeDelta &&
        !mod &&
        !ev.altKey &&
        !shouldBlockCanvasShortcut &&
        useProjectStore.getState().selectedNodeIds.length > 0
      ) {
        ev.preventDefault();
        nudgeSelectedNodes(nudgeDelta.dx, nudgeDelta.dy);
        return;
      }

      if (key === "tab" && !mod && !ev.altKey && !shouldBlockCanvasShortcut) {
        ev.preventDefault();
        openAddPanelCenter();
        return;
      }

      if (mod && ev.shiftKey && key === "h" && !shouldBlockCanvasShortcut) {
        ev.preventDefault();
        toggleHermes();
        return;
      }

      const isRedoCombo =
        (mod && key === "z" && ev.shiftKey) || (mod && key === "y" && !ev.shiftKey);
      const isUndoCombo = mod && key === "z" && !ev.shiftKey;

      if (isRedoCombo) {
        if (!shouldBlockCanvasShortcut) {
          ev.preventDefault();
          redo();
        }
        return;
      }
      if (isUndoCombo) {
        if (!shouldBlockCanvasShortcut) {
          ev.preventDefault();
          undo();
        }
        return;
      }

      if (mod && !ev.shiftKey && !ev.altKey && key === "n" && !shouldBlockCanvasShortcut) {
        ev.preventDefault();
        void newProject();
        return;
      }
      if (mod && !ev.shiftKey && !ev.altKey && key === "o" && !shouldBlockCanvasShortcut) {
        ev.preventDefault();
        void openProject();
        return;
      }
      if (mod && !ev.shiftKey && !ev.altKey && key === "s" && !shouldBlockCanvasShortcut) {
        ev.preventDefault();
        void saveProject();
        return;
      }

      const isUngroup = mod && ev.altKey && ev.shiftKey && key === "g";
      const isGroup = mod && key === "g" && !ev.shiftKey && !ev.altKey;
      const isDup = mod && ev.shiftKey && key === "c";
      const isGenerate = mod && key === "enter";
      const isCopy = mod && key === "c" && !ev.shiftKey;
      const isPaste = mod && key === "v";
      const isDelete = ev.key === "Delete" || ev.key === "Backspace";
      const isOpenTextComposer = mod && ev.shiftKey && key === "g" && !ev.altKey;

      if (isUngroup && !shouldBlockCanvasShortcut) {
        ev.preventDefault();
        ungroupSelectedNodes();
        return;
      }
      if (isGroup && !shouldBlockCanvasShortcut) {
        ev.preventDefault();
        groupSelectedNodes();
        return;
      }
      if (isDup && !shouldBlockCanvasShortcut) {
        ev.preventDefault();
        duplicateSelection();
        return;
      }
      if (isGenerate && !shouldBlockCanvasShortcut) {
        ev.preventDefault();
        runGenerateShortcut();
        return;
      }
      if (isCopy && !shouldBlockCanvasShortcut) {
        ev.preventDefault();
        copySelection();
        return;
      }
      if (isPaste && !shouldBlockCanvasShortcut) {
        ev.preventDefault();
        pasteSelection();
        return;
      }
      if (isDelete && !shouldBlockCanvasShortcut) {
        ev.preventDefault();
        deleteSelection();
        return;
      }
      if (isOpenTextComposer && !shouldBlockCanvasShortcut) {
        const { selectedNodeIds, nodes, edges: allEdges } = useProjectStore.getState();
        if (selectedNodeIds.length === 1) {
          const selected = nodes.find((n) => n.id === selectedNodeIds[0]);
          if (selected?.type === "textNode") {
            ev.preventDefault();
            if (isPassiveTextContainer(selected.id, nodes, allEdges)) {
              setStatusText(TEXT_PASSIVE_CONTAINER_STATUS);
              return;
            }
            setTextGenPanelPinnedNodeId(selected.id);
            setStatusText("已打开模型对话面板（Ctrl+Shift+G）");
            return;
          }
          if (selected?.type === "audioNode") {
            ev.preventDefault();
            if (isPassiveAudioAsset(selected.id, nodes, allEdges)) {
              setStatusText(AUDIO_PASSIVE_REFERENCE_STATUS);
              return;
            }
            setAudioTtsPanelPinnedNodeId(selected.id);
            setAudioTtsPanelNodeId(selected.id);
            setStatusText("已打开文字转语音面板（Ctrl+Shift+G）");
          }
        }
      }
    };
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, [
    copySelection,
    deleteSelection,
    nudgeSelectedNodes,
    duplicateSelection,
    groupSelectedNodes,
    newProject,
    openAddPanelCenter,
    openProject,
    pasteSelection,
    redo,
    runGenerateShortcut,
    saveProject,
    setStatusText,
    setAudioTtsPanelNodeId,
    setAudioTtsPanelPinnedNodeId,
    setTextGenPanelPinnedNodeId,
    toggleShortcutsOverlay,
    ungroupSelectedNodes,
    undo,
  ]);

  useEffect(() => {
    const onAgentEvent = (ev: Event) => {
      if (!isTauri()) return;
      if (!projectPath) return;
      const detail = (ev as CustomEvent<NodeAgentRuntimeEvent>).detail;
      if (!detail) return;
      void appendNodeAgentEvent({
        projectPath,
        nodeId: detail.nodeId,
        agentName: detail.agentName,
        phase: detail.phase,
        elapsedMs: detail.elapsedMs,
        error: detail.error,
        runId: lastRunId ?? undefined,
      }).then((newRunId) => {
        // 若当前无 run_id，将新生成的 run_id 回填到 store（单节点即席运行场景）
        if (!lastRunId) {
          setLastRunId(newRunId);
        }
      });
    };
    window.addEventListener("node-agent-event", onAgentEvent);
    return () => window.removeEventListener("node-agent-event", onAgentEvent);
  }, [lastRunId, projectPath, setLastRunId]);

  useEffect(() => {
    const onOpenSettings = (ev: Event) => {
      const detail = (ev as CustomEvent<OpenSettingsDetail>).detail;
      setSettingsOpenRequest((prev) => ({
        category: detail?.category ?? null,
        focusSectionId: detail?.focusSectionId ?? null,
        nonce: prev.nonce + 1,
      }));
      setSettingsOpen(true);
    };
    window.addEventListener("r3-open-settings", onOpenSettings);
    return () => window.removeEventListener("r3-open-settings", onOpenSettings);
  }, []);

  // 已有画布内容但无 Tab 时补一条（兼容旧会话 / 热更新）
  useEffect(() => {
    const { tabs } = useCanvasUiStore.getState();
    if (tabs.length > 0) return;
    const { nodes, projectPath } = useProjectStore.getState();
    if (nodes.length > 0 || projectPath) bindActiveTabToProject();
  }, []);

  // 初始化 Hermes 自动串联
  useEffect(() => {
    const cleanup = initHermesAutoChain();
    return cleanup;
  }, []);

  useEffect(() => {
    collapseHermes();
  }, [collapseHermes]);

  useEffect(() => {
    syncCanvasMcpBridgeContext(projectPath);
  }, [projectPath]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (
        scriptFullscreenNodeId ||
        composeEditorNodeId ||
        confirmDialog?.open ||
        pendingUpdate ||
        settingsOpen
      ) {
        return;
      }
      if (hermesJobDrawerOpen) {
        e.preventDefault();
        closeHermesJobDrawer();
        return;
      }
      if (hermesMode === "expanded") {
        e.preventDefault();
        collapseHermes();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    collapseHermes,
    closeHermesJobDrawer,
    composeEditorNodeId,
    confirmDialog?.open,
    pendingUpdate,
    hermesJobDrawerOpen,
    hermesMode,
    scriptFullscreenNodeId,
    settingsOpen,
  ]);

  // 初始化节点状态监听器
  useNodeStatusListener();

  return (
    <div className="appShell">
      <AppTopBar />

      <div className="mainSplit">
        <FlowCanvas />
      </div>
      <HermesOrbSuggestionBridge />

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        initialCategory={settingsOpenRequest.category}
        focusSectionId={settingsOpenRequest.focusSectionId}
        openRequestNonce={settingsOpenRequest.nonce}
        onOpenShortcuts={() => {
          setSettingsOpen(false);
          toggleShortcutsOverlay();
        }}
      />
      {scriptFullscreenNodeId ? <ScriptNodeFullscreenOverlay /> : null}
      {composeEditorNodeId ? <ComposeEditorOverlay /> : null}
      <ConfirmDialog />
      {pendingUpdate ? (
        <AppUpdateDialog pending={pendingUpdate} onClose={dismissPendingUpdate} />
      ) : null}
      <HermesScriptVersionDiffOverlay />
    </div>
  );
}
