import { describe, expect, it, vi, beforeEach } from "vitest";
import type { FlowNodeData } from "@/lib/types";
import type { Node } from "@xyflow/react";
import { describeWorkspaceCloseRisk } from "./canvasCloseGuard";

vi.mock("@/lib/canvasTabSync", () => ({
  persistActiveTabSnapshot: vi.fn(),
}));

const mockCanvasUi = vi.hoisted(() => ({
  tabs: [] as Array<{
    id: string;
    name: string;
    projectPath: string | null;
    unsaved: boolean;
    nodes: Node<FlowNodeData>[];
    edges: [];
    viewport: { x: 0; y: 0; zoom: 1 };
  }>,
  activeTabId: null as string | null,
}));

const mockProject = vi.hoisted(() => ({
  nodes: [] as Node<FlowNodeData>[],
  projectDirty: false,
}));

vi.mock("@/store/canvasUiStore", () => ({
  useCanvasUiStore: {
    getState: () => ({
      tabs: mockCanvasUi.tabs,
      activeTabId: mockCanvasUi.activeTabId,
    }),
  },
}));

vi.mock("@/store/projectStore", () => ({
  useProjectStore: {
    getState: () => ({
      nodes: mockProject.nodes,
      projectDirty: mockProject.projectDirty,
    }),
  },
}));

function videoNode(
  id: string,
  jobStatus?: "queued" | "running",
): Node<FlowNodeData> {
  return {
    id,
    type: "videoNode",
    position: { x: 0, y: 0 },
    data: {
      label: "视频1",
      video: jobStatus
        ? {
            activeJob: {
              id: "j1",
              status: jobStatus,
              modelId: "m1",
              startedAt: "2026-01-01T00:00:00.000Z",
            },
            draft: {} as never,
          }
        : { draft: {} as never },
    },
  };
}

beforeEach(() => {
  mockCanvasUi.tabs = [];
  mockCanvasUi.activeTabId = null;
  mockProject.nodes = [];
  mockProject.projectDirty = false;
});

describe("describeWorkspaceCloseRisk", () => {
  it("aggregates dirty tabs and video jobs across tabs", () => {
    mockCanvasUi.tabs = [
      {
        id: "t1",
        name: "A",
        projectPath: "/a",
        unsaved: true,
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
      {
        id: "t2",
        name: "B",
        projectPath: "/b",
        unsaved: true,
        nodes: [videoNode("v2", "running")],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    ];
    mockCanvasUi.activeTabId = "t1";
    mockProject.nodes = [videoNode("v1", "queued")];
    mockProject.projectDirty = true;

    const risk = describeWorkspaceCloseRisk();
    expect(risk.shouldConfirm).toBe(true);
    expect(risk.projectDirty).toBe(true);
    expect(risk.activeVideoJobCount).toBe(2);
    expect(risk.message).toContain("2 个标签页");
    expect(risk.message).toContain("2 个视频任务");
  });

  it("uses active store for active tab", () => {
    mockCanvasUi.tabs = [
      {
        id: "t1",
        name: "A",
        projectPath: "/a",
        unsaved: false,
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    ];
    mockCanvasUi.activeTabId = "t1";
    mockProject.projectDirty = true;

    const risk = describeWorkspaceCloseRisk();
    expect(risk.shouldConfirm).toBe(true);
    expect(risk.projectDirty).toBe(true);
  });
});
