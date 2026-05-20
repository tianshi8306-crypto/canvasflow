import { useCallback } from "react";
import { clampContextMenuPosition } from "@/lib/clampFloatingUi";
import { FLOW_MENU } from "@/components/canvas/menuConstants";
import type { FlowCanvasMenuState } from "@/components/canvas/flowCanvasMenuState";

interface UseMenuHandlersOptions {
  setMenuState: (s: FlowCanvasMenuState | null) => void;
  setSubjectCreationNodeId: (id: string | null) => void;
  subjectPanelNodeIdRef: React.MutableRefObject<string | null>;
}

export function useMenuHandlers({
  setMenuState,
  setSubjectCreationNodeId,
  subjectPanelNodeIdRef,
}: UseMenuHandlersOptions) {
  const openAddPanelAt = useCallback(
    (x: number, y: number, nodeId: string | null = null) => {
      const p = clampContextMenuPosition(x, y, FLOW_MENU.widths.contextPaneL2, FLOW_MENU.clampEstimatedHeight);
      setMenuState({ x: p.x, y: p.y, mode: "add-panel", nodeId, addPanelTab: "types" });
    },
    [setMenuState],
  );

  const openPaneContextAt = useCallback(
    (x: number, y: number) => {
      const p = clampContextMenuPosition(x, y, FLOW_MENU.widths.contextPaneL1, FLOW_MENU.clampEstimatedHeight);
      setMenuState({ x: p.x, y: p.y, mode: "context-pane", nodeId: null, paneAddSubmenu: false });
    },
    [setMenuState],
  );

  const openNodeContextAt = useCallback(
    (x: number, y: number, nodeId: string) => {
      const p = clampContextMenuPosition(x, y, FLOW_MENU.widths.context, FLOW_MENU.clampEstimatedHeight);
      setMenuState({ x: p.x, y: p.y, mode: "context-node", nodeId });
    },
    [setMenuState],
  );

  const openEdgeContextAt = useCallback(
    (x: number, y: number, edgeId: string) => {
      const p = clampContextMenuPosition(x, y, FLOW_MENU.widths.context, FLOW_MENU.clampEstimatedHeight);
      setMenuState({ x: p.x, y: p.y, mode: "context-edge", nodeId: null, edgeId });
    },
    [setMenuState],
  );

  const openGalleryFromDock = useCallback(() => {
    const p = clampContextMenuPosition(240, 200, FLOW_MENU.widths.gallery, FLOW_MENU.clampEstimatedHeight);
    setMenuState({ x: p.x, y: p.y, mode: "add-panel", nodeId: null, addPanelTab: "gallery" });
  }, [setMenuState]);

  const openSubjectCreationAt = useCallback(
    (nodeId: string) => {
      subjectPanelNodeIdRef.current = nodeId;
      setSubjectCreationNodeId(nodeId);
    },
    [subjectPanelNodeIdRef, setSubjectCreationNodeId],
  );

  return {
    openAddPanelAt,
    openPaneContextAt,
    openNodeContextAt,
    openEdgeContextAt,
    openGalleryFromDock,
    openSubjectCreationAt,
  };
}
