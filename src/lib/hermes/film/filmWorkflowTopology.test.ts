import { describe, expect, it, beforeEach } from "vitest";
import { applyShortDramaWorkflow } from "@/lib/hermes/film/filmWorkflowTopology";
import { useProjectStore } from "@/store/projectStore";

describe("applyShortDramaWorkflow", () => {
  beforeEach(() => {
    useProjectStore.setState({
      nodes: [],
      edges: [],
      selectedNodeIds: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    });
  });

  it("creates text and script nodes with edge", () => {
    const result = applyShortDramaWorkflow({
      brief: "雨夜短剧",
      anchor: { x: 400, y: 300 },
    });
    const state = useProjectStore.getState();
    expect(result.createdText).toBe(true);
    expect(result.createdScript).toBe(true);
    expect(result.linkedTextToScript).toBe(true);
    expect(state.nodes.some((n) => n.type === "textNode")).toBe(true);
    expect(state.nodes.some((n) => n.type === "scriptNode")).toBe(true);
    expect(state.edges.length).toBeGreaterThan(0);
  });

  it("reuses existing script node", () => {
    useProjectStore.setState({
      nodes: [
        {
          id: "existing-script",
          type: "scriptNode",
          position: { x: 100, y: 100 },
          data: { label: "脚本", prompt: "已有" },
        },
      ],
      edges: [],
    });
    const result = applyShortDramaWorkflow({ brief: "新大纲", anchor: { x: 400, y: 300 } });
    expect(result.createdScript).toBe(false);
    expect(result.scriptNodeId).toBe("existing-script");
    expect(useProjectStore.getState().nodes.filter((n) => n.type === "scriptNode")).toHaveLength(
      1,
    );
  });
});
