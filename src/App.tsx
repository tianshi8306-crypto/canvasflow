import { isTauri } from "@tauri-apps/api/core";
import { appendNodeAgentEvent } from "@/shared/api/runs";
import { useEffect, useState } from "react";
import { FlowCanvas } from "@/components/FlowCanvas";
import { AppTopBar } from "@/components/AppTopBar";
import { SettingsPanel } from "@/components/SettingsPanel";
import { ScriptNodeFullscreenOverlay } from "@/components/ScriptNodeFullscreenOverlay";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { NodeAgentRuntimeEvent } from "@/lib/nodeAgentRuntime/types";
import { useProjectStore } from "@/store/projectStore";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { initHermesAutoChain } from "@/lib/hermes";
import {
  isPassiveAudioAsset,
  AUDIO_PASSIVE_REFERENCE_STATUS,
} from "@/lib/audioNodeContainerMode";
import {
  isPassiveTextContainer,
  TEXT_PASSIVE_CONTAINER_STATUS,
} from "@/lib/textNodeContainerMode";
import { useNodeStatusListener } from "@/hooks/useNodeStatus";

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  const scriptFullscreenNodeId = useProjectStore((s) => s.scriptFullscreenNodeId);
  const projectPath = useProjectStore((s) => s.projectPath);
  const lastRunId = useProjectStore((s) => s.lastRunId);
  const setLastRunId = useProjectStore((s) => s.setLastRunId);
  const groupSelectedNodes = useProjectStore((s) => s.groupSelectedNodes);
  const copySelection = useProjectStore((s) => s.copySelection);
  const pasteSelection = useProjectStore((s) => s.pasteSelection);
  const deleteSelection = useProjectStore((s) => s.deleteSelection);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const setTextGenPanelPinnedNodeId = useCanvasUiStore((s) => s.setTextGenPanelPinnedNodeId);
  const setAudioTtsPanelPinnedNodeId = useCanvasUiStore((s) => s.setAudioTtsPanelPinnedNodeId);
  const setAudioTtsPanelNodeId = useCanvasUiStore((s) => s.setAudioTtsPanelNodeId);
  const setStatusText = useProjectStore((s) => s.setStatusText);

  useEffect(() => {
    const onKeydown = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null;
      const active = document.activeElement as HTMLElement | null;
      const textNodeEditingMode = Boolean(
        document.querySelector(
          [
            ".textNodeCard--editing",
            ".textNodeWriteSelfEditable:focus",
            ".textNodeEditable--integrated:focus",
            ".textNodeExpandPanel textarea:focus",
            ".scriptGenComposerInput:focus",
          ].join(","),
        ),
      );
      const isEditableEl = (el: HTMLElement | null) =>
        Boolean(
          el &&
            (el.tagName === "INPUT" ||
              el.tagName === "TEXTAREA" ||
              (typeof el.isContentEditable === "boolean" && el.isContentEditable) ||
              el.closest("input, textarea, [contenteditable='true'], [contenteditable='plaintext-only']")),
        );
      const editingInput = isEditableEl(target) || isEditableEl(active);

      const mod = ev.ctrlKey || ev.metaKey;
      const key = ev.key.toLowerCase();
      const isRedoCombo =
        (mod && key === "z" && ev.shiftKey) || (mod && key === "y" && !ev.shiftKey);
      const isUndoCombo = mod && key === "z" && !ev.shiftKey;

      if (isRedoCombo) {
        if (!editingInput) {
          ev.preventDefault();
          redo();
        }
        return;
      }
      if (isUndoCombo) {
        if (!editingInput) {
          ev.preventDefault();
          undo();
        }
        return;
      }

      const isGroup = mod && key === "g";
      const isCopy = mod && key === "c";
      const isPaste = mod && key === "v";
      const isDelete = ev.key === "Delete" || ev.key === "Backspace";
      const isOpenTextComposer = mod && ev.shiftKey && key === "g";
      const shouldBlockCanvasShortcut = editingInput || textNodeEditingMode;
      if (isGroup) {
        if (!shouldBlockCanvasShortcut) {
          ev.preventDefault();
          groupSelectedNodes();
        }
        return;
      }
      if (isCopy) {
        if (!shouldBlockCanvasShortcut) {
          ev.preventDefault();
          copySelection();
        }
        return;
      }
      if (isPaste) {
        if (!shouldBlockCanvasShortcut) {
          ev.preventDefault();
          pasteSelection();
        }
        return;
      }
      if (isDelete) {
        if (!shouldBlockCanvasShortcut) {
          ev.preventDefault();
          deleteSelection();
        }
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
    groupSelectedNodes,
    pasteSelection,
    redo,
    setStatusText,
    setAudioTtsPanelNodeId,
    setAudioTtsPanelPinnedNodeId,
    setTextGenPanelPinnedNodeId,
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
    const onOpenSettings = () => setSettingsOpen(true);
    window.addEventListener("r3-open-settings", onOpenSettings);
    return () => window.removeEventListener("r3-open-settings", onOpenSettings);
  }, []);

  // 初始化 Hermes 自动串联
  useEffect(() => {
    const cleanup = initHermesAutoChain();
    return cleanup;
  }, []);

  // 初始化节点状态监听器
  useNodeStatusListener();

  return (
    <div className="appShell">
      <AppTopBar />

      <div className="mainSplit">
        <FlowCanvas />
      </div>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {scriptFullscreenNodeId ? <ScriptNodeFullscreenOverlay /> : null}
      <ConfirmDialog />
    </div>
  );
}
