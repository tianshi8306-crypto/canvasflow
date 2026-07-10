import { useCallback } from "react";
import { isTextInputTarget } from "@/lib/canvasInteraction";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";

/** 判断是否在输入框 / 文本节点编辑态，应拦截画布快捷键 */
export function isCanvasShortcutBlockedTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  const active = document.activeElement as HTMLElement | null;
  const textNodeEditingMode = Boolean(
    document.querySelector(
      [
        ".textNodeCard--editing",
        ".textNodeWriteSelfEditable:focus",
        ".textNodeEditable--integrated:focus",
        ".textNodeExpandPanel textarea:focus",
        ".scriptGenComposerInput:focus",
        ".mention-textarea:focus",
        ".scriptGenComposer:focus-within",
        ".hermesShellInput:focus",
      ].join(","),
    ),
  );
  const inExpandedGenPanel = (node: HTMLElement | null) =>
    Boolean(
      node?.closest(
        ".igp-expanded-overlay, .tgp-expanded-overlay, .sgp-expanded-overlay, .atp-expanded-overlay",
      ),
    );
  const isEditableEl = (node: HTMLElement | null) =>
    Boolean(node && (isTextInputTarget(node) || node.closest(".canvasShortcutsOverlayCard")));
  return (
    isEditableEl(el) ||
    isEditableEl(active) ||
    textNodeEditingMode ||
    inExpandedGenPanel(el) ||
    inExpandedGenPanel(active)
  );
}

export function useCanvasShortcutActions() {
  const queueAddPanelAt = useCanvasUiStore((s) => s.queueAddPanelAt);
  const setShortcutsOverlayOpen = useCanvasUiStore((s) => s.setShortcutsOverlayOpen);
  const toggleShortcutsOverlay = useCallback(() => {
    const open = useCanvasUiStore.getState().shortcutsOverlayOpen;
    setShortcutsOverlayOpen(!open);
  }, [setShortcutsOverlayOpen]);

  const duplicateSelection = useCallback(() => {
    const { selectedNodeIds, nodes, duplicateGroup, copySelection, pasteSelection, flowClipboardCount } =
      useProjectStore.getState();
    if (selectedNodeIds.length === 1) {
      const hit = nodes.find((n) => n.id === selectedNodeIds[0]);
      if (hit?.type === "group") {
        duplicateGroup(hit.id);
        return;
      }
    }
    copySelection();
    if (flowClipboardCount === 0) return;
    pasteSelection();
    useProjectStore.getState().setStatusText("已创建副本");
  }, []);

  const runGenerateShortcut = useCallback(() => {
    const { selectedNodeIds, nodes, runNodeSubgraph, runGroupSubgraph, runWorkflow } =
      useProjectStore.getState();
    if (selectedNodeIds.length === 1) {
      const id = selectedNodeIds[0]!;
      const node = nodes.find((n) => n.id === id);
      if (node?.type === "group") {
        void runGroupSubgraph(id);
        return;
      }
      void runNodeSubgraph(id);
      return;
    }
    void runWorkflow();
  }, []);

  const openAddPanelCenter = useCallback(() => {
    queueAddPanelAt(Math.round(window.innerWidth / 2), Math.round(window.innerHeight / 2));
  }, [queueAddPanelAt]);

  return {
    duplicateSelection,
    runGenerateShortcut,
    openAddPanelCenter,
    toggleShortcutsOverlay,
    isBlocked: isCanvasShortcutBlockedTarget,
  };
}
