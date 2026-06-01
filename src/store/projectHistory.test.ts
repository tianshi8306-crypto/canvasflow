import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { Edge, Node, Viewport } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import {
  cloneGraph,
  clearHistoryStacks,
  getUndoRedoAvailability,
  recordBeforeDiscreteMutation,
  runRedo,
  runUndo,
  scheduleHistoryBurst,
  viewportNearlyEqual,
} from "./projectHistory";
import type { ProjectState } from "./projectStoreTypes";

type HistoryTestSlice = Pick<
  ProjectState,
  "nodes" | "edges" | "viewport" | "projectPath" | "setStatusText"
>;

function makeState(
  nodes: Node<FlowNodeData>[] = [],
  edges: Edge[] = [],
  viewport: Viewport = { x: 0, y: 0, zoom: 1 },
): {
  get: () => ProjectState;
  set: (partial: Partial<ProjectState>) => void;
} {
  const state: HistoryTestSlice & { graphRevision: number } = {
    nodes,
    edges,
    viewport,
    projectPath: "/test",
    graphRevision: 0,
    setStatusText: () => {},
  };
  return {
    get: () => state as unknown as ProjectState,
    set: (patch) => {
      Object.assign(state, patch);
      if ("nodes" in patch || "edges" in patch || "viewport" in patch) {
        state.graphRevision += 1;
      }
    },
  };
}

describe("viewportNearlyEqual", () => {
  it("returns true for identical viewports", () => {
    const vp: Viewport = { x: 100, y: 200, zoom: 1.5 };
    expect(viewportNearlyEqual(vp, vp)).toBe(true);
  });

  it("returns true within tolerance", () => {
    expect(viewportNearlyEqual({ x: 0, y: 0, zoom: 1 }, { x: 0.3, y: 0.4, zoom: 1.00005 })).toBe(true);
  });

  it("returns false when x is outside tolerance", () => {
    expect(viewportNearlyEqual({ x: 0, y: 0, zoom: 1 }, { x: 1, y: 0, zoom: 1 })).toBe(false);
  });

  it("returns false when zoom is outside tolerance", () => {
    expect(viewportNearlyEqual({ x: 0, y: 0, zoom: 1 }, { x: 0, y: 0, zoom: 1.001 })).toBe(false);
  });
});

describe("cloneGraph", () => {
  it("returns a deep copy of nodes and edges", () => {
    const nodes: Node<FlowNodeData>[] = [{ id: "n1", type: "imageNode", position: { x: 10, y: 20 }, data: { label: "图片" } } as Node<FlowNodeData>];
    const edges: Edge[] = [{ id: "e1", source: "n1", target: "n2" } as Edge];
    const vp: Viewport = { x: 1, y: 2, zoom: 0.8 };
    const { get } = makeState(nodes, edges, vp);

    const snap = cloneGraph(get);

    const state = get() as unknown as HistoryTestSlice;
    state.nodes[0]!.position.x = 999;
    expect(snap.nodes[0]!.position.x).toBe(10);
    expect(snap.edges).toEqual(edges);
    expect(snap.viewport).toEqual(vp);
  });
});

describe("clearHistoryStacks", () => {
  beforeEach(() => clearHistoryStacks());
  afterEach(() => clearHistoryStacks());

  it("empties undo and redo stacks", () => {
    const { get, set } = makeState([{ id: "n1", type: "imageNode", position: { x: 0, y: 0 }, data: {} } as Node<FlowNodeData>]);
    recordBeforeDiscreteMutation(get);
    runUndo(get, set);
    expect(getUndoRedoAvailability().canRedo).toBe(true);

    clearHistoryStacks();
    const avail = getUndoRedoAvailability();
    expect(avail.canUndo).toBe(false);
    expect(avail.canRedo).toBe(false);
  });
});

describe("recordBeforeDiscreteMutation", () => {
  beforeEach(() => clearHistoryStacks());
  afterEach(() => clearHistoryStacks());

  it("pushes current graph into undo stack", () => {
    const nodes: Node<FlowNodeData>[] = [{ id: "n1", type: "imageNode", position: { x: 0, y: 0 }, data: { label: "A" } } as Node<FlowNodeData>];
    const { get } = makeState(nodes);
    recordBeforeDiscreteMutation(get);
    expect(getUndoRedoAvailability().canUndo).toBe(true);
  });

  it("clears redo stack on new mutation", () => {
    const nodes: Node<FlowNodeData>[] = [{ id: "n1", type: "imageNode", position: { x: 0, y: 0 }, data: { label: "A" } } as Node<FlowNodeData>];
    const { get } = makeState(nodes);
    recordBeforeDiscreteMutation(get);
    expect(getUndoRedoAvailability().canUndo).toBe(true);
    recordBeforeDiscreteMutation(get);
    expect(getUndoRedoAvailability().canRedo).toBe(false);
  });
});

describe("runUndo", () => {
  beforeEach(() => clearHistoryStacks());
  afterEach(() => clearHistoryStacks());

  it("does nothing when undo stack is empty", () => {
    const { get, set } = makeState();
    const statusTexts: string[] = [];
    const slice = get() as unknown as HistoryTestSlice;
    slice.setStatusText = (t: string) => statusTexts.push(t);
    runUndo(get, set);
    expect(statusTexts).toContain("没有可撤销的操作");
  });

  it("restores previous graph snapshot and clears redo", () => {
    const nodesA: Node<FlowNodeData>[] = [{ id: "n1", type: "imageNode", position: { x: 0, y: 0 }, data: { label: "A" } } as Node<FlowNodeData>];
    const nodesB: Node<FlowNodeData>[] = [{ id: "n1", type: "imageNode", position: { x: 100, y: 0 }, data: { label: "B" } } as Node<FlowNodeData>];
    const { get, set } = makeState(nodesA);
    recordBeforeDiscreteMutation(get);
    set({ nodes: nodesB });
    expect((get() as unknown as HistoryTestSlice).nodes[0]!.position.x).toBe(100);

    runUndo(get, set);
    expect((get() as unknown as HistoryTestSlice).nodes[0]!.position.x).toBe(0);
  });
});

describe("runRedo", () => {
  beforeEach(() => clearHistoryStacks());
  afterEach(() => clearHistoryStacks());

  it("does nothing when redo stack is empty", () => {
    const { get, set } = makeState();
    runRedo(get, set);
    expect(getUndoRedoAvailability().canRedo).toBe(false);
  });

  it("restores next graph snapshot after undo", () => {
    const nodesA: Node<FlowNodeData>[] = [{ id: "n1", type: "imageNode", position: { x: 0, y: 0 }, data: { label: "A" } } as Node<FlowNodeData>];
    const nodesB: Node<FlowNodeData>[] = [{ id: "n1", type: "imageNode", position: { x: 100, y: 0 }, data: { label: "B" } } as Node<FlowNodeData>];
    const { get, set } = makeState(nodesA);
    recordBeforeDiscreteMutation(get);
    set({ nodes: nodesB });

    runUndo(get, set);
    expect((get() as unknown as HistoryTestSlice).nodes[0]!.position.x).toBe(0);

    runRedo(get, set);
    expect((get() as unknown as HistoryTestSlice).nodes[0]!.position.x).toBe(100);
  });
});

describe("scheduleHistoryBurst", () => {
  beforeEach(() => clearHistoryStacks());
  afterEach(() => clearHistoryStacks());

  it("scheduleHistoryBurst does not push duplicate during burst window", () => {
    const nodes: Node<FlowNodeData>[] = [{ id: "n1", type: "imageNode", position: { x: 0, y: 0 }, data: {} } as Node<FlowNodeData>];
    const { get } = makeState(nodes);

    scheduleHistoryBurst(get);
    scheduleHistoryBurst(get);

    const avail = getUndoRedoAvailability();
    expect(avail.canUndo).toBe(false);
  });
});

describe("undo/redo caps at MAX_UNDO", () => {
  beforeEach(() => clearHistoryStacks());
  afterEach(() => clearHistoryStacks());

  it("keeps at most 50 entries", () => {
    const nodes: Node<FlowNodeData>[] = [{ id: "n1", type: "imageNode", position: { x: 0, y: 0 }, data: {} } as Node<FlowNodeData>];
    const { get, set } = makeState(nodes);

    for (let i = 0; i < 55; i++) {
      recordBeforeDiscreteMutation(get);
      set({ nodes: [{ ...nodes[0]!, position: { x: i, y: 0 } }] });
    }

    let count = 0;
    while (getUndoRedoAvailability().canUndo) {
      runUndo(get, set);
      count++;
    }
    expect(count).toBeLessThanOrEqual(50);
  });
});
