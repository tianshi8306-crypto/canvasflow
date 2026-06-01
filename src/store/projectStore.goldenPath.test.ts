import { describe, expect, it, beforeEach } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData, ScriptBeat } from "@/lib/types";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";

const beat = (id: string): ScriptBeat =>
  ({
    id,
    shotNumber: "1",
    scene: "",
    durationHint: "",
    description: "",
    character1: "",
    character1Desc: "",
    character1Image: "",
    character2: "",
    character2Desc: "",
    character2Image: "",
    reference: "",
    shotSize: "",
    characterAction: "",
    emotion: "",
    sceneTags: "",
    lightingMood: "",
    soundEffect: "",
    dialogue: "",
    storyboardPrompt: "",
    videoMotionPrompt: "",
  }) as ScriptBeat;

function resetStores() {
  useCanvasUiStore.setState({ tabs: [], activeTabId: null, composeEditorNodeId: null });
  useProjectStore.setState({
    projectPath: null,
    nodes: [],
    edges: [],
    projectDirty: false,
    selectedNodeId: null,
    selectedNodeIds: [],
    selectedEdgeIds: [],
    statusText: "未打开工程",
  });
}

describe("projectStore — golden path tab sync", () => {
  beforeEach(resetStores);

  it("addNode creates a tab and marks unsaved when tabs were empty", () => {
    useProjectStore.getState().addNode({
      id: "t1",
      type: "textNode",
      position: { x: 0, y: 0 },
      data: { label: "文本 1", prompt: "" },
    });

    expect(useProjectStore.getState().projectDirty).toBe(true);
    const { tabs, activeTabId } = useCanvasUiStore.getState();
    expect(tabs).toHaveLength(1);
    expect(tabs[0]?.id).toBe(activeTabId);
    expect(tabs[0]?.unsaved).toBe(true);
    expect(tabs[0]?.nodes).toHaveLength(1);
  });
});

describe("projectStore.exportScriptCompose", () => {
  beforeEach(resetStores);

  it("creates concat node with timeline clips without auto render", async () => {
    const nodes: Node<FlowNodeData>[] = [
      {
        id: "s1",
        type: "scriptNode",
        position: { x: 0, y: 0 },
        data: { label: "脚本", scriptBeats: [beat("b1")], storyboardShots: [] },
      },
      {
        id: "v1",
        type: "videoNode",
        position: { x: 200, y: 0 },
        data: {
          label: "视频 1",
          path: "assets/clip.mp4",
          params: { scriptBeatId: "b1" },
        },
      },
    ];
    const edges: Edge[] = [{ id: "e1", source: "s1", target: "v1" }];

    useProjectStore.setState({
      projectPath: "/tmp/demo-project",
      nodes,
      edges,
    });

    const result = await useProjectStore.getState().exportScriptCompose("s1", { autoRender: false });
    expect(result).not.toBeNull();
    expect(result?.createdConcat).toBe(true);
    expect(result?.clipPaths).toEqual(["assets/clip.mp4"]);

    const state = useProjectStore.getState();
    const concat = state.nodes.find((n) => n.type === "ffmpegConcat");
    expect(concat).toBeDefined();
    expect(concat?.data.timelineClips?.length).toBe(1);
    expect(useCanvasUiStore.getState().composeEditorNodeId).toBe(concat?.id);
  });

  it("returns null when project is not open", async () => {
    useProjectStore.setState({
      nodes: [
        {
          id: "s1",
          type: "scriptNode",
          position: { x: 0, y: 0 },
          data: { scriptBeats: [beat("b1")] },
        },
      ],
    });
    const result = await useProjectStore.getState().exportScriptCompose("s1", { autoRender: false });
    expect(result).toBeNull();
    expect(useProjectStore.getState().statusText).toContain("请先打开工程");
  });
});
