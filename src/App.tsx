import { invoke, isTauri } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { FlowCanvas } from "@/components/FlowCanvas";
import { AppTopBar } from "@/components/AppTopBar";
import { SettingsPanel } from "@/components/SettingsPanel";
import { ScriptNodeFullscreenOverlay } from "@/components/ScriptNodeFullscreenOverlay";
import type { NodeAgentRuntimeEvent } from "@/lib/nodeAgentRuntime/types";
import { useProjectStore } from "@/store/projectStore";

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  const scriptFullscreenNodeId = useProjectStore((s) => s.scriptFullscreenNodeId);
  const projectPath = useProjectStore((s) => s.projectPath);
  const lastRunId = useProjectStore((s) => s.lastRunId);
  const groupSelectedNodes = useProjectStore((s) => s.groupSelectedNodes);
  const copySelection = useProjectStore((s) => s.copySelection);
  const pasteSelection = useProjectStore((s) => s.pasteSelection);
  const deleteSelection = useProjectStore((s) => s.deleteSelection);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);

  useEffect(() => {
    const onKeydown = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null;
      const active = document.activeElement as HTMLElement | null;
      const textNodeEditingMode = Boolean(
        document.querySelector(
          [
            ".textNodeCard--editing",
            ".textNodeWriteSelfEditable:focus",
            ".textNodeEditable:focus",
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
      }
    };
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, [copySelection, deleteSelection, groupSelectedNodes, pasteSelection, redo, undo]);

  useEffect(() => {
    const onAgentEvent = (ev: Event) => {
      if (!isTauri()) return;
      if (!projectPath || !lastRunId) return;
      const detail = (ev as CustomEvent<NodeAgentRuntimeEvent>).detail;
      if (!detail) return;
      void invoke("append_agent_event", {
        projectPath,
        runId: lastRunId,
        nodeId: detail.nodeId,
        agentName: detail.agentName,
        phase: detail.phase,
        elapsedMs: detail.elapsedMs,
        error: detail.error ?? null,
      });
    };
    window.addEventListener("node-agent-event", onAgentEvent);
    return () => window.removeEventListener("node-agent-event", onAgentEvent);
  }, [lastRunId, projectPath]);

  useEffect(() => {
    const onOpenSettings = () => setSettingsOpen(true);
    window.addEventListener("r3-open-settings", onOpenSettings);
    return () => window.removeEventListener("r3-open-settings", onOpenSettings);
  }, []);

  return (
    <div className="appShell">
      <AppTopBar onOpenSettings={() => setSettingsOpen(true)} />

      <div className="mainSplit">
        <FlowCanvas />
      </div>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {scriptFullscreenNodeId ? <ScriptNodeFullscreenOverlay /> : null}
    </div>
  );
}
