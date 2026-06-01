import { describe, expect, it, beforeEach, vi } from "vitest";
import type { Edge, Node, Viewport } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { useCanvasUiStore } from "./canvasUiStore";

const defaultViewport: Viewport = { x: 0, y: 0, zoom: 1 };

function makeTab(overrides: Partial<{
  name: string; projectPath: string; unsaved: boolean; nodes: Node<FlowNodeData>[]; edges: Edge[]; viewport: Viewport;
}> = {}): Omit<import("./canvasUiStore").CanvasTab, "id"> {
  return {
    name: overrides.name ?? "Test Tab",
    projectPath: overrides.projectPath ?? "/test/project",
    unsaved: overrides.unsaved ?? false,
    nodes: overrides.nodes ?? [],
    edges: overrides.edges ?? [],
    viewport: overrides.viewport ?? defaultViewport,
  };
}

function resetStore() {
  useCanvasUiStore.setState({
    tabs: [],
    activeTabId: null,
    confirmDialog: null,
    nodeDragSuppressUi: false,
    maximizedNodeId: null,
    composeEditorNodeId: null,
    canvasFitRequestNodeId: null,
    imageGenPanelExpandedNodeId: null,
    audioTtsPanelNodeId: null,
    imageI2iTargetNodeId: null,
    markedNodeId: null,
    minimapVisible: false,
    subjectListVersion: 0,
    viewportInteracting: false,
    nodeSnapAlignmentEnabled: true,
    nodeSnapVisual: null,
    selectionRelatedHighlightColor: "white" as const,
    snapGuidesEnabled: true,
    connectionLinesVisible: true,
    snapGridEnabled: false,
    alignFeatureTriggerMode: "click" as const,
    alignDistributeGap: 40,
    multiSelectGridCols: 3 as const,
    nodeSpacing: 120,
    nodeDirection: "right" as const,
    nodeAvoidOverlap: true,
    showVideoMeta: true,
    imageVideoNodeResizeEnabled: true,
    promptBoxResizeEnabled: true,
    titleFollowsCanvasZoom: true,
    themePreset: "dark" as const,
    fontSize: "medium" as const,
    cursorStyle: "default" as const,
    gridDotsVisible: true,
    shortcutsOverlayOpen: false,
    pendingAddPanelAt: null,
    emptyGuideDismissed: false,
    anchorDragConnect: null,
    anchorMenuRequest: null,
    anchorMenuOpenedAt: 0,
    anchorMenuDismissEpoch: 0,
    anchorConnectDrag: null,
    pendingAnchorConnection: null,
    projectPanelOpen: false,
  });
}

describe("canvasUiStore — tabs", () => {
  beforeEach(resetStore);

  it("starts with empty tabs", () => {
    const store = useCanvasUiStore.getState();
    expect(store.tabs).toEqual([]);
    expect(store.activeTabId).toBeNull();
  });

  it("addTab appends a new tab and sets it active", () => {
    const ok = useCanvasUiStore.getState().addTab(makeTab({ name: "My Tab" }));
    expect(ok).toBe(true);
    const tabs = useCanvasUiStore.getState().tabs;
    expect(tabs).toHaveLength(1);
    expect(tabs[0]!.name).toBe("My Tab");
    expect(useCanvasUiStore.getState().activeTabId).toBe(tabs[0]!.id);
  });

  it("addTab rejects when MAX_TABS (20) is reached", () => {
    useCanvasUiStore.setState({
      tabs: Array.from({ length: 20 }, (_, i) => ({
        id: `tab-${i}`,
        name: `Tab ${i}`,
        projectPath: "/test",
        unsaved: false,
        nodes: [],
        edges: [],
        viewport: defaultViewport,
      })),
      activeTabId: "tab-0",
    });

    const ok = useCanvasUiStore.getState().addTab(makeTab({ name: "Overflow" }));
    expect(ok).toBe(false);
    expect(useCanvasUiStore.getState().tabs).toHaveLength(20);
  });

  it("removeTab deletes the tab and activates the previous (or next) tab", () => {
    useCanvasUiStore.setState({
      tabs: [
        { id: "t1", name: "Tab 1", projectPath: "/p1", unsaved: false, nodes: [], edges: [], viewport: defaultViewport },
        { id: "t2", name: "Tab 2", projectPath: "/p2", unsaved: false, nodes: [], edges: [], viewport: defaultViewport },
      ],
      activeTabId: "t1",
    });

    useCanvasUiStore.getState().removeTab("t1");

    const tabs = useCanvasUiStore.getState().tabs;
    expect(tabs).toHaveLength(1);
    expect(tabs[0]!.id).toBe("t2");
    expect(useCanvasUiStore.getState().activeTabId).toBe("t2");
  });

  it("removeTab updates activeTabId to previous when last tab is removed", () => {
    useCanvasUiStore.setState({
      tabs: [
        { id: "t1", name: "Tab 1", projectPath: "/p1", unsaved: false, nodes: [], edges: [], viewport: defaultViewport },
        { id: "t2", name: "Tab 2", projectPath: "/p2", unsaved: false, nodes: [], edges: [], viewport: defaultViewport },
      ],
      activeTabId: "t2",
    });

    useCanvasUiStore.getState().removeTab("t2");

    expect(useCanvasUiStore.getState().tabs).toHaveLength(1);
    expect(useCanvasUiStore.getState().activeTabId).toBe("t1");
  });

  it("removeTab does nothing if tab id not found", () => {
    useCanvasUiStore.setState({
      tabs: [
        { id: "t1", name: "Tab 1", projectPath: "/p1", unsaved: false, nodes: [], edges: [], viewport: defaultViewport },
      ],
      activeTabId: "t1",
    });

    useCanvasUiStore.getState().removeTab("nonexistent");

    expect(useCanvasUiStore.getState().tabs).toHaveLength(1);
  });

  it("setActiveTab switches active tab", () => {
    useCanvasUiStore.setState({
      tabs: [
        { id: "t1", name: "Tab 1", projectPath: "/p1", unsaved: false, nodes: [], edges: [], viewport: defaultViewport },
        { id: "t2", name: "Tab 2", projectPath: "/p2", unsaved: true, nodes: [], edges: [], viewport: defaultViewport },
      ],
      activeTabId: "t1",
    });

    useCanvasUiStore.getState().setActiveTab("t2");
    expect(useCanvasUiStore.getState().activeTabId).toBe("t2");
  });

  it("updateTab applies patch to the matching tab", () => {
    useCanvasUiStore.setState({
      tabs: [
        { id: "t1", name: "Tab 1", projectPath: "/p1", unsaved: false, nodes: [], edges: [], viewport: defaultViewport },
      ],
      activeTabId: "t1",
    });

    useCanvasUiStore.getState().updateTab("t1", { name: "Updated Tab", unsaved: true });

    const tab = useCanvasUiStore.getState().tabs[0]!;
    expect(tab.name).toBe("Updated Tab");
    expect(tab.unsaved).toBe(true);
  });

  it("updateTabUnsaved sets unsaved flag on the correct tab", () => {
    useCanvasUiStore.setState({
      tabs: [
        { id: "t1", name: "Tab 1", projectPath: "/p1", unsaved: false, nodes: [], edges: [], viewport: defaultViewport },
        { id: "t2", name: "Tab 2", projectPath: "/p2", unsaved: false, nodes: [], edges: [], viewport: defaultViewport },
      ],
      activeTabId: "t1",
    });

    useCanvasUiStore.getState().updateTabUnsaved("t1", true);
    expect(useCanvasUiStore.getState().tabs[0]!.unsaved).toBe(true);
    expect(useCanvasUiStore.getState().tabs[1]!.unsaved).toBe(false);
  });
});

describe("canvasUiStore — confirmDialog", () => {
  beforeEach(resetStore);

  it("starts with null confirmDialog", () => {
    expect(useCanvasUiStore.getState().confirmDialog).toBeNull();
  });

  it("openConfirmDialog sets dialog state with callbacks stored", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    useCanvasUiStore.getState().openConfirmDialog({ title: "Delete?", message: "Are you sure", onConfirm, onCancel });

    const dialog = useCanvasUiStore.getState().confirmDialog;
    expect(dialog).not.toBeNull();
    expect(dialog!.title).toBe("Delete?");
    expect(dialog!.message).toBe("Are you sure");
    // Callbacks are stored as references
    expect(typeof dialog!.onConfirm).toBe("function");
    expect(typeof dialog!.onCancel).toBe("function");
  });

  it("closeConfirmDialog clears dialog", () => {
    useCanvasUiStore.getState().openConfirmDialog({ title: "X", message: "Y", onConfirm: vi.fn(), onCancel: vi.fn() });

    useCanvasUiStore.getState().closeConfirmDialog();

    expect(useCanvasUiStore.getState().confirmDialog).toBeNull();
  });
});

describe("canvasUiStore — transient UI", () => {
  beforeEach(resetStore);

  it("clearTransientUi resets audio TTS UI and imageI2iTargetNodeId", () => {
    useCanvasUiStore.setState({
      audioTtsPanelNodeId: "node-1",
      audioTtsPanelPinnedNodeId: "node-1",
      audioTtsPanelExpandedNodeId: "node-1",
      imageI2iTargetNodeId: "node-2",
    });

    useCanvasUiStore.getState().clearTransientUi();

    expect(useCanvasUiStore.getState().audioTtsPanelNodeId).toBeNull();
    expect(useCanvasUiStore.getState().audioTtsPanelPinnedNodeId).toBeNull();
    expect(useCanvasUiStore.getState().audioTtsPanelExpandedNodeId).toBeNull();
    expect(useCanvasUiStore.getState().imageI2iTargetNodeId).toBeNull();
  });
});

describe("canvasUiStore — boolean flags", () => {
  beforeEach(resetStore);

  it("nodeSnapAlignmentEnabled defaults to true", () => {
    expect(useCanvasUiStore.getState().nodeSnapAlignmentEnabled).toBe(true);
  });

  it("setNodeSnapAlignmentEnabled updates the flag", () => {
    useCanvasUiStore.getState().setNodeSnapAlignmentEnabled(false);
    expect(useCanvasUiStore.getState().nodeSnapAlignmentEnabled).toBe(false);
  });

  it("multiSelectGridCols defaults to 3", () => {
    expect(useCanvasUiStore.getState().multiSelectGridCols).toBe(3);
  });

  it("setMultiSelectGridCols updates grid columns", () => {
    useCanvasUiStore.getState().setMultiSelectGridCols(4);
    expect(useCanvasUiStore.getState().multiSelectGridCols).toBe(4);
  });

  it("viewportInteracting defaults to false", () => {
    expect(useCanvasUiStore.getState().viewportInteracting).toBe(false);
  });

  it("setViewportInteracting updates", () => {
    useCanvasUiStore.getState().setViewportInteracting(true);
    expect(useCanvasUiStore.getState().viewportInteracting).toBe(true);
  });

  it("bumpSubjectListVersion increments counter", () => {
    useCanvasUiStore.setState({ subjectListVersion: 5 });
    useCanvasUiStore.getState().bumpSubjectListVersion();
    expect(useCanvasUiStore.getState().subjectListVersion).toBe(6);
  });
});

describe("canvasUiStore — anchorDragConnect", () => {
  beforeEach(resetStore);

  it("starts as null", () => {
    expect(useCanvasUiStore.getState().anchorDragConnect).toBeNull();
  });

  it("setAnchorDragConnect sets value", () => {
    const val = { nodeId: "n1", handleId: "h1", handleType: "source" as const, side: "left" as const, screenX: 100, screenY: 200 };
    useCanvasUiStore.getState().setAnchorDragConnect(val);
    expect(useCanvasUiStore.getState().anchorDragConnect).toEqual(val);
  });

  it("setAnchorDragConnect can be set back to null", () => {
    useCanvasUiStore.getState().setAnchorDragConnect({ nodeId: "n1", handleId: "h1", handleType: "source", side: "left", screenX: 100, screenY: 200 });
    useCanvasUiStore.getState().setAnchorDragConnect(null);
    expect(useCanvasUiStore.getState().anchorDragConnect).toBeNull();
  });
});