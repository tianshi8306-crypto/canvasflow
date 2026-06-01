import { beforeEach, describe, expect, it } from "vitest";
import {
  SCRIPT_ENTRY_FULLSCREEN_LABEL,
  SCRIPT_ENTRY_THEME_LABEL,
  SCRIPT_MINI_PREVIEW_OPEN_HINT,
  SCRIPT_NODE_ENTRY_HINT,
  openInspectorStoryboardBeat,
} from "@/lib/scriptNodeCanvasEntries";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";

describe("scriptNodeCanvasEntries labels", () => {
  it("exposes stable entry copy for toolbar and preview", () => {
    expect(SCRIPT_ENTRY_FULLSCREEN_LABEL).toBe("全屏表格");
    expect(SCRIPT_ENTRY_THEME_LABEL).toBe("编辑主题");
    expect(SCRIPT_MINI_PREVIEW_OPEN_HINT).toContain("全屏");
    expect(SCRIPT_NODE_ENTRY_HINT).not.toContain("Inspector");
    expect(SCRIPT_NODE_ENTRY_HINT).toContain("全屏表格");
  });
});

describe("openInspectorStoryboardBeat", () => {
  beforeEach(() => {
    useProjectStore.setState({
      scriptFullscreenNodeId: null,
      selectedNodeIds: [],
      selectedNodeId: null,
    } as Partial<ReturnType<typeof useProjectStore.getState>>);
    useCanvasUiStore.setState({ inspectorStoryboardFocus: null });
  });

  it("opens script fullscreen and sets storyboard focus", () => {
    openInspectorStoryboardBeat("script-1", "beat-a");
    expect(useProjectStore.getState().scriptFullscreenNodeId).toBe("script-1");
    expect(useProjectStore.getState().selectedNodeIds).toEqual(["script-1"]);
    expect(useCanvasUiStore.getState().inspectorStoryboardFocus).toEqual({
      scriptNodeId: "script-1",
      beatId: "beat-a",
    });
  });
});
