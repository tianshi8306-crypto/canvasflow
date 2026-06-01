import { describe, expect, it, beforeEach } from "vitest";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";
import {
  bindActiveTabToProject,
  persistActiveTabSnapshot,
  restoreProjectFromTab,
  syncActiveTabUnsaved,
  tabNameFromProjectPath,
} from "./canvasTabSync";

describe("tabNameFromProjectPath", () => {
  it("returns fallback for empty path", () => {
    expect(tabNameFromProjectPath(null)).toBe("未命名画布");
    expect(tabNameFromProjectPath("")).toBe("未命名画布");
  });

  it("uses last path segment on windows and posix paths", () => {
    expect(tabNameFromProjectPath("D:/projects/demo")).toBe("demo");
    expect(tabNameFromProjectPath("C:\\Users\\me\\my-canvas")).toBe("my-canvas");
  });
});

describe("bindActiveTabToProject — temp canvas dirty", () => {
  beforeEach(() => {
    useCanvasUiStore.setState({ tabs: [], activeTabId: null });
    useProjectStore.setState({
      projectPath: null,
      nodes: [],
      edges: [],
      projectDirty: false,
      statusText: "未打开工程",
    });
  });

  it("reflects projectDirty on tab when there is no projectPath", () => {
    useProjectStore.setState({
      projectDirty: true,
      nodes: [
        {
          id: "n1",
          type: "textNode",
          position: { x: 0, y: 0 },
          data: { label: "x" },
        },
      ],
    });
    bindActiveTabToProject();
    const tab = useCanvasUiStore.getState().tabs[0];
    expect(tab?.unsaved).toBe(true);
    expect(tab?.projectPath).toBeNull();
  });
});

describe("syncActiveTabUnsaved", () => {
  beforeEach(() => {
    useCanvasUiStore.getState().addTab({
      name: "画布 1",
      projectPath: null,
      unsaved: false,
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    });
  });

  it("updates active tab unsaved flag", () => {
    syncActiveTabUnsaved(true);
    const tab = useCanvasUiStore.getState().tabs[0];
    expect(tab?.unsaved).toBe(true);
  });
});

describe("restoreProjectFromTab", () => {
  beforeEach(() => {
    useCanvasUiStore.setState({ tabs: [], activeTabId: null });
    useProjectStore.setState({
      projectPath: "/old",
      nodes: [{ id: "n0", type: "textNode", position: { x: 0, y: 0 }, data: { label: "old" } }],
      edges: [],
      projectDirty: true,
      statusText: "",
    });
  });

  it("restores nodes and dirty from tab snapshot", () => {
    const tab = {
      id: "tab-a",
      name: "画布 B",
      projectPath: null,
      unsaved: false,
      nodes: [{ id: "n2", type: "textNode", position: { x: 1, y: 2 }, data: { label: "new" } }],
      edges: [],
      viewport: { x: 10, y: 20, zoom: 1.2 },
    };
    restoreProjectFromTab(tab);
    const s = useProjectStore.getState();
    expect(s.nodes).toHaveLength(1);
    expect(s.nodes[0]?.id).toBe("n2");
    expect(s.projectDirty).toBe(false);
    expect(s.viewport).toEqual(tab.viewport);
  });
});

describe("tab switch workflow", () => {
  beforeEach(() => {
    useCanvasUiStore.setState({ tabs: [], activeTabId: null });
    useProjectStore.setState({
      projectPath: null,
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      projectDirty: false,
      statusText: "未打开工程",
    });
  });

  it("persist + restore keeps separate graphs when switching tabs", () => {
    useProjectStore.setState({
      nodes: [
        {
          id: "n-text",
          type: "textNode",
          position: { x: 0, y: 0 },
          data: { label: "Tab A" },
        },
      ],
      projectDirty: true,
    });
    bindActiveTabToProject();
    const tabAId = useCanvasUiStore.getState().activeTabId!;
    persistActiveTabSnapshot();

    useCanvasUiStore.getState().addTab({
      name: "画布 2",
      projectPath: null,
      unsaved: false,
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    });
    const tabB = useCanvasUiStore.getState().tabs.find((t) => t.id !== tabAId)!;
    restoreProjectFromTab(tabB);
    useProjectStore.setState({
      nodes: [
        {
          id: "n-script",
          type: "scriptNode",
          position: { x: 100, y: 0 },
          data: { label: "Tab B" },
        },
      ],
      projectDirty: true,
    });
    persistActiveTabSnapshot();

    const tabA = useCanvasUiStore.getState().tabs.find((t) => t.id === tabAId)!;
    restoreProjectFromTab(tabA);
    expect(useProjectStore.getState().nodes.map((n) => n.id)).toEqual(["n-text"]);

    const tabBRefreshed = useCanvasUiStore.getState().tabs.find((t) => t.id === tabB.id)!;
    restoreProjectFromTab(tabBRefreshed);
    expect(useProjectStore.getState().nodes.map((n) => n.id)).toEqual(["n-script"]);
  });
});

describe("persistActiveTabSnapshot", () => {
  beforeEach(() => {
    useCanvasUiStore.getState().addTab({
      name: "画布 1",
      projectPath: null,
      unsaved: false,
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    });
    useProjectStore.setState({
      projectDirty: true,
      nodes: [{ id: "n1", type: "textNode", position: { x: 0, y: 0 }, data: { label: "x" } }],
    });
  });

  it("writes current graph into active tab", () => {
    persistActiveTabSnapshot();
    const tab = useCanvasUiStore.getState().tabs[0];
    expect(tab?.nodes).toHaveLength(1);
    expect(tab?.unsaved).toBe(true);
  });
});
