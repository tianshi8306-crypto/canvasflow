import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Edge,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { create } from "zustand";
import { newNodeDataByType } from "@/lib/canvasNodeDefaults";
import { formatUserError } from "@/lib/errors";
import { DESKTOP_SHELL_HINT } from "@/lib/tauriEnv";
import { FIRST_LAST_FRAME_EXAMPLE_PROMPT } from "@/lib/firstLastFrameSetup";
import { FIRST_FRAME_DEFAULT_PROMPT } from "@/lib/videoInputConstraints";
import {
  computeNextLeftInputY,
  leftInputColumnX,
} from "@/lib/videoInputNodeLayout";
import {
  CANVAS_NODE_LAYOUT_GAP,
  computeBatchImportDropPositions,
  nodeLayoutDimensions,
} from "@/lib/nodeLayout";
import { snapNodePositionChanges } from "@/lib/nodeSnapAlignment";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import {
  connectionRejectedReason,
  getOutputPortType,
  isConnectionAllowed,
  sanitizeCanvasEdges,
  validateConnection,
} from "@/lib/flowConnectionPolicy";
import { makeFlowEdge } from "@/lib/flowEdge";
import {
  edgeToggleStatusText,
  isEdgeDisabled,
} from "@/lib/edgeState";
import { buildPasteEdgesFromClipboard, buildPasteNodesFromClipboard } from "@/lib/buildPasteNodesFromClipboard";
import { cloneFlowNodeData } from "@/lib/flowNodeDataClone";
import { defaultViewport, parseCanvas, serializeCanvas } from "@/lib/serialization";
import type { FlowNodeData } from "@/lib/types";
import { importMediaFiles as importMediaFilesApi } from "@/shared/api/assets";
import { defaultVideoGenerationDraft, defaultVideoNodePersisted } from "@/lib/videoNodeTypes";
import { getFlowClipboard, getFlowClipboardCount, setFlowClipboard } from "./projectClipboard";
import {
  clearHistoryStacks,
  recordBeforeDiscreteMutation,
  scheduleHistoryBurst,
  viewportNearlyEqual,
  runUndo,
  runRedo,
} from "./projectHistory";
export { getUndoRedoAvailability } from "./projectHistory";
import { scheduleSave } from "./projectSaveDebounce";
import { focusShellAfterNativeDialog } from "./projectShellFocus";
import type { ProjectState } from "./projectStoreTypes";
export type { GraphSnapshot, ProjectState } from "./projectStoreTypes";
import {
  rerunFailedSubgraphImpl,
  runNodeSubgraphImpl,
  runWorkflowImpl,
} from "./projectWorkflowRuns";

export const useProjectStore = create<ProjectState>((set, get) => ({
  projectPath: null,
  nodes: [],
  edges: [],
  viewport: defaultViewport,
  selectedNodeId: null,
  selectedNodeIds: [],
  selectedEdgeIds: [],
  lastSavedAt: null,
  lastRunId: null,
  nodeRunStateById: {},
  isGraphRunning: false,
  statusText: "未打开工程",
  flowClipboardCount: 0,
  scriptFullscreenNodeId: null,

  setProjectPath: (p) => set({ projectPath: p }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setSelectedNodeIds: (ids) => set({ selectedNodeIds: ids, selectedNodeId: ids[0] ?? null }),
  setSelectedEdgeIds: (ids) => set({ selectedEdgeIds: ids }),
  setStatusText: (t) => set({ statusText: t }),
  setViewport: (v) => set({ viewport: v }),
  openScriptFullscreen: (nodeId) => set({ scriptFullscreenNodeId: nodeId }),
  closeScriptFullscreen: () => set({ scriptFullscreenNodeId: null }),

  onNodesChange: (changes) => {
    scheduleHistoryBurst(get);
    const nodes = get().nodes;
    const snapOn = useCanvasUiStore.getState().nodeSnapAlignmentEnabled;
    const nextChanges = snapOn
      ? snapNodePositionChanges(changes as NodeChange<Node<FlowNodeData>>[], nodes)
      : (changes as NodeChange<Node<FlowNodeData>>[]);
    set((s) => ({ nodes: applyNodeChanges(nextChanges, s.nodes) }));
    if (get().projectPath) scheduleSave(get);
  },
  onEdgesChange: (changes) => {
    scheduleHistoryBurst(get);
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges) }));
    if (get().projectPath) scheduleSave(get);
  },
  onConnect: (c) => {
    const nodes = get().nodes;
    const verdict = validateConnection(c, nodes, get().edges);
    if (!verdict.ok) {
      set({ statusText: `已取消连线：${verdict.reason}` });
      return;
    }
    const sn = nodes.find((n) => n.id === c.source);
    if (!sn) return;
    const payloadType = getOutputPortType(sn.type);
    recordBeforeDiscreteMutation(get);
    set((s) => ({
      edges: addEdge(
        {
          ...c,
          id: crypto.randomUUID(),
          animated: true,
          style: { strokeWidth: 2, stroke: "#60a5fa" },
          ...(payloadType ? { data: { payloadType } } : {}),
        },
        s.edges,
      ),
    }));
    if (get().projectPath) scheduleSave(get);
  },

  updateNodeData: (id, patch) => {
    recordBeforeDiscreteMutation(get);
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...patch } } : n,
      ),
    }));
    if (get().projectPath) scheduleSave(get);
  },

  newProject: async () => {
    if (!isTauri()) {
      set({ statusText: DESKTOP_SHELL_HINT });
      return;
    }
    try {
      const folder = await invoke<string | null>("pick_project_folder");
      if (!folder) return;
      await invoke("ensure_project_structure", { projectPath: folder });
      clearHistoryStacks();
      set({
        projectPath: folder,
        nodes: [],
        edges: [],
        viewport: defaultViewport,
        selectedNodeId: null,
        selectedNodeIds: [],
        selectedEdgeIds: [],
        lastRunId: null,
        nodeRunStateById: {},
        statusText: `工程：${folder}`,
        flowClipboardCount: getFlowClipboardCount(),
      });
      await focusShellAfterNativeDialog();
      await get().saveProject();
    } catch (e) {
      set({ statusText: `新建工程失败：${formatUserError(e)}` });
    }
  },

  openProject: async () => {
    if (!isTauri()) {
      set({ statusText: DESKTOP_SHELL_HINT });
      return;
    }
    try {
      const folder = await invoke<string | null>("pick_project_folder");
      if (!folder) return;
      await invoke("ensure_project_structure", { projectPath: folder });
    try {
      const raw = await invoke<string>("read_canvasflow_json", { projectPath: folder });
      const { nodes, edges, viewport, invalidEdgesDropped } = parseCanvas(raw);
      clearHistoryStacks();
      const statusBase = `工程：${folder}`;
      set({
        projectPath: folder,
        nodes,
        edges,
        viewport,
        selectedNodeId: null,
        selectedNodeIds: [],
        selectedEdgeIds: [],
        lastRunId: null,
        nodeRunStateById: {},
        statusText:
          invalidEdgesDropped > 0
            ? `${statusBase}（已移除 ${invalidEdgesDropped} 条不兼容连线）`
            : statusBase,
        flowClipboardCount: getFlowClipboardCount(),
      });
      await focusShellAfterNativeDialog();
    } catch {
      const empty = serializeCanvas([], [], defaultViewport);
      await invoke("write_canvasflow_json", { projectPath: folder, content: empty });
      clearHistoryStacks();
      set({
        projectPath: folder,
        nodes: [],
        edges: [],
        viewport: defaultViewport,
        selectedNodeId: null,
        selectedNodeIds: [],
        selectedEdgeIds: [],
        lastRunId: null,
        nodeRunStateById: {},
        statusText: `工程：${folder}（已创建空白 canvasflow.json）`,
        flowClipboardCount: getFlowClipboardCount(),
      });
      await focusShellAfterNativeDialog();
    }
    } catch (e) {
      set({ statusText: `打开工程失败：${formatUserError(e)}` });
    }
  },

  saveProject: async () => {
    if (!isTauri()) {
      set({ statusText: DESKTOP_SHELL_HINT });
      return;
    }
    const { projectPath, nodes, edges, viewport } = get();
    if (!projectPath) return;
    try {
      const content = serializeCanvas(nodes, edges, viewport);
      await invoke("write_canvasflow_json", { projectPath, content });
      set({ lastSavedAt: Date.now() });
    } catch (e) {
      set({ statusText: `保存失败：${formatUserError(e)}` });
    }
  },

  runWorkflow: runWorkflowImpl(get, set),

  runNodeSubgraph: runNodeSubgraphImpl(get, set),

  rerunFailedSubgraph: rerunFailedSubgraphImpl(get, set),

  addNode: (node) => {
    recordBeforeDiscreteMutation(get);
    set((s) => ({ nodes: [...s.nodes, node] }));
    if (get().projectPath) scheduleSave(get);
  },

  addNodesWithEdges: (newNodes, newEdges) => {
    recordBeforeDiscreteMutation(get);
    const mergedNodes = [...get().nodes, ...newNodes];
    const { edges: cleanedNew } = sanitizeCanvasEdges(mergedNodes, newEdges);
    set((s) => ({
      nodes: [...s.nodes, ...newNodes],
      edges: [...s.edges, ...cleanedNew],
    }));
    if (get().projectPath) scheduleSave(get);
  },

  spawnAnchoredPartner: ({ anchorNodeId, direction, partnerType }) => {
    const state = get();
    const anchor = state.nodes.find((n) => n.id === anchorNodeId);
    if (!anchor) return;
    const sourceT = direction === "incoming" ? partnerType : anchor.type;
    const targetT = direction === "incoming" ? anchor.type : partnerType;
    if (!isConnectionAllowed(sourceT, targetT)) {
      const msg = connectionRejectedReason(sourceT, targetT);
      set({ statusText: msg ? `无法创建连线：${msg}` : "无法创建连线：类型不匹配" });
      return;
    }
    const factory = newNodeDataByType[partnerType];
    const newId = crypto.randomUUID();
    const gap = 400;
    const pos =
      direction === "incoming"
        ? { x: anchor.position.x - gap, y: anchor.position.y }
        : { x: anchor.position.x + gap, y: anchor.position.y };
    const newNode: Node<FlowNodeData> = {
      id: newId,
      type: partnerType,
      position: pos,
      data: factory(),
    };
    const edge =
      direction === "incoming"
        ? makeFlowEdge(newId, anchorNodeId, partnerType)
        : makeFlowEdge(anchorNodeId, newId, anchor.type ?? undefined);
    recordBeforeDiscreteMutation(get);
    set((s) => ({
      nodes: [...s.nodes, newNode],
      edges: [...s.edges, edge],
    }));
    if (get().projectPath) scheduleSave(get);
    get().setSelectedNodeIds([newId]);
    get().setStatusText(direction === "incoming" ? "已在左侧添加并联线" : "已在右侧添加并联线");
  },

  setupFirstLastFrameForVideoNode: (videoNodeId) => {
    const state = get();
    const vNode = state.nodes.find((n) => n.id === videoNodeId && n.type === "videoNode");
    if (!vNode) return;

    const incomingToVideo = state.edges.filter(
      (e) =>
        !isEdgeDisabled(e) &&
        e.target === videoNodeId &&
        (!e.targetHandle || e.targetHandle === "in"),
    );
    const imageSourceIds = [
      ...new Set(
        incomingToVideo
          .map((e) => e.source)
          .filter((sid) => state.nodes.find((n) => n.id === sid)?.type === "imageNode"),
      ),
    ];

    const curVideo = vNode.data.video ?? defaultVideoNodePersisted();

    const buildMergedVideo = (refPaths: string[]) => ({
      ...defaultVideoNodePersisted(),
      ...curVideo,
      draft: {
        ...defaultVideoGenerationDraft(),
        ...curVideo.draft,
        workflow: "first_last_frame" as const,
        prompt: curVideo.draft.prompt?.trim()
          ? curVideo.draft.prompt
          : FIRST_LAST_FRAME_EXAMPLE_PROMPT,
        referenceImagePaths: refPaths.length >= 2 ? refPaths.slice(0, 2) : [],
      },
    });

    const IMG_W = 280;
    const IMG_H = 200;
    const STACK_GAP = 24;
    const H_GAP = CANVAS_NODE_LAYOUT_GAP;
    const vx = vNode.position.x;
    const vy = vNode.position.y;

    if (imageSourceIds.length >= 2) {
      const sorted = [...imageSourceIds].sort((a, b) => {
        const na = state.nodes.find((n) => n.id === a)!;
        const nb = state.nodes.find((n) => n.id === b)!;
        return na.position.y - nb.position.y;
      });
      const paths = sorted
        .map((id) => state.nodes.find((n) => n.id === id)?.data.path?.trim() ?? "")
        .filter(Boolean);
      recordBeforeDiscreteMutation(get);
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === videoNodeId
            ? { ...n, data: { ...n.data, video: buildMergedVideo(paths) } }
            : n,
        ),
      }));
      if (get().projectPath) scheduleSave(get);
      get().setSelectedNodeIds([videoNodeId]);
      get().setStatusText("已切换为首尾帧模式，并填入示例提示词");
      return;
    }

    const newNodes: Node<FlowNodeData>[] = [];
    const newEdges: Edge[] = [];
    let existingIdToLabelAsFirst: string | null = null;

    if (imageSourceIds.length === 0) {
      const firstId = crypto.randomUUID();
      const lastId = crypto.randomUUID();
      const imgX = vx - IMG_W - H_GAP;
      newNodes.push(
        {
          id: firstId,
          type: "imageNode",
          position: { x: imgX, y: vy },
          data: { ...newNodeDataByType.imageNode(), label: "首帧" },
        },
        {
          id: lastId,
          type: "imageNode",
          position: { x: imgX, y: vy + IMG_H + STACK_GAP },
          data: { ...newNodeDataByType.imageNode(), label: "尾帧" },
        },
      );
      newEdges.push(
        makeFlowEdge(firstId, videoNodeId, "imageNode"),
        makeFlowEdge(lastId, videoNodeId, "imageNode"),
      );
    } else {
      const existingId = imageSourceIds[0];
      const existing = state.nodes.find((n) => n.id === existingId)!;
      const newId = crypto.randomUUID();
      newNodes.push({
        id: newId,
        type: "imageNode",
        position: { x: existing.position.x, y: existing.position.y + IMG_H + STACK_GAP },
        data: { ...newNodeDataByType.imageNode(), label: "尾帧" },
      });
      newEdges.push(makeFlowEdge(newId, videoNodeId, "imageNode"));
      existingIdToLabelAsFirst = existingId;
    }

    const mergedVideo = buildMergedVideo([]);

    recordBeforeDiscreteMutation(get);
    set((s) => {
      let nextNodes = [...s.nodes, ...newNodes].map((n) => {
        if (existingIdToLabelAsFirst && n.id === existingIdToLabelAsFirst) {
          return { ...n, data: { ...n.data, label: "首帧" } };
        }
        return n;
      });
      nextNodes = nextNodes.map((n) =>
        n.id === videoNodeId ? { ...n, data: { ...n.data, video: mergedVideo } } : n,
      );
      return {
        nodes: nextNodes,
        edges: [...s.edges, ...newEdges],
      };
    });
    if (get().projectPath) scheduleSave(get);
    get().setSelectedNodeIds([videoNodeId]);
    get().setStatusText("已在左侧添加首帧与尾帧图片节点并联线，可上传图片后生成");
  },

  setupFirstFrameVideoForVideoNode: (videoNodeId) => {
    const state = get();
    const vNode = state.nodes.find((n) => n.id === videoNodeId && n.type === "videoNode");
    if (!vNode) return;

    const incomingToVideo = state.edges.filter(
      (e) =>
        !isEdgeDisabled(e) &&
        e.target === videoNodeId &&
        (!e.targetHandle || e.targetHandle === "in"),
    );
    const imageSourceIds = [
      ...new Set(
        incomingToVideo
          .map((e) => e.source)
          .filter((sid) => state.nodes.find((n) => n.id === sid)?.type === "imageNode"),
      ),
    ];

    const curVideo = vNode.data.video ?? defaultVideoNodePersisted();

    const buildMergedVideo = (refPaths: string[]) => ({
      ...defaultVideoNodePersisted(),
      ...curVideo,
      draft: {
        ...defaultVideoGenerationDraft(),
        ...curVideo.draft,
        workflow: "multimodal_reference" as const,
        prompt: curVideo.draft.prompt?.trim() ? curVideo.draft.prompt : FIRST_FRAME_DEFAULT_PROMPT,
        referenceImagePaths: refPaths.length ? refPaths.slice(0, 9) : [],
      },
    });

    const IMG_W = 280;
    const H_GAP = CANVAS_NODE_LAYOUT_GAP;
    const vx = vNode.position.x;
    const vy = vNode.position.y;

    if (imageSourceIds.length >= 1) {
      const sorted = [...imageSourceIds].sort((a, b) => {
        const na = state.nodes.find((n) => n.id === a)!;
        const nb = state.nodes.find((n) => n.id === b)!;
        return na.position.y - nb.position.y;
      });
      const paths = sorted
        .map((id) => state.nodes.find((n) => n.id === id)?.data.path?.trim() ?? "")
        .filter(Boolean)
        .slice(0, 9);
      recordBeforeDiscreteMutation(get);
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === videoNodeId
            ? { ...n, data: { ...n.data, video: buildMergedVideo(paths) } }
            : n,
        ),
      }));
      if (get().projectPath) scheduleSave(get);
      get().setSelectedNodeIds([videoNodeId]);
      get().setStatusText("已切换为全能参考（首帧），并填入示例提示词");
      return;
    }

    const firstId = crypto.randomUUID();
    const imgX = vx - IMG_W - H_GAP;
    const newNodes: Node<FlowNodeData>[] = [
      {
        id: firstId,
        type: "imageNode",
        position: { x: imgX, y: vy },
        data: { ...newNodeDataByType.imageNode(), label: "首帧" },
      },
    ];
    const newEdges: Edge[] = [makeFlowEdge(firstId, videoNodeId, "imageNode")];
    const mergedVideo = buildMergedVideo([]);

    recordBeforeDiscreteMutation(get);
    set((s) => {
      const nextNodes = [...s.nodes, ...newNodes].map((n) =>
        n.id === videoNodeId ? { ...n, data: { ...n.data, video: mergedVideo } } : n,
      );
      return {
        nodes: nextNodes,
        edges: [...s.edges, ...newEdges],
      };
    });
    if (get().projectPath) scheduleSave(get);
    get().setSelectedNodeIds([videoNodeId]);
    get().setStatusText("已在左侧添加首帧图片节点，上传或生成图片后即可在面板中预览");
  },

  addInputNodeLeftOfVideo: (videoNodeId, kind) => {
    const state = get();
    const vNode = state.nodes.find((n) => n.id === videoNodeId && n.type === "videoNode");
    if (!vNode) return;

    const y = computeNextLeftInputY(state.nodes, state.edges, videoNodeId, vNode.position.y);
    const x = leftInputColumnX(vNode.position.x);
    const newId = crypto.randomUUID();

    let node: Node<FlowNodeData>;
    if (kind === "image") {
      node = {
        id: newId,
        type: "imageNode",
        position: { x, y },
        data: { ...newNodeDataByType.imageNode() },
      };
    } else if (kind === "referenceVideo") {
      node = {
        id: newId,
        type: "videoNode",
        position: { x, y },
        data: { ...newNodeDataByType.videoNode() },
      };
    } else {
      node = {
        id: newId,
        type: "audioNode",
        position: { x, y },
        data: { ...newNodeDataByType.audioNode() },
      };
    }

    const sourceEdgeType =
      kind === "image" ? "imageNode" : kind === "referenceVideo" ? "videoNode" : "audioNode";
    recordBeforeDiscreteMutation(get);
    set((s) => ({
      nodes: [...s.nodes, node],
      edges: [...s.edges, makeFlowEdge(newId, videoNodeId, sourceEdgeType)],
    }));
    if (get().projectPath) scheduleSave(get);
    get().setSelectedNodeIds([newId]);
    get().setStatusText("已在左侧添加输入节点并联线；成片输出请从本节点右侧连接");
  },

  loadGraph: (nodes, edges, viewport) => {
    clearHistoryStacks();
    const { edges: cleanedEdges } = sanitizeCanvasEdges(nodes, edges);
    set({
      nodes,
      edges: cleanedEdges,
      viewport,
      selectedNodeId: null,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      flowClipboardCount: getFlowClipboardCount(),
    });
    if (get().projectPath) scheduleSave(get);
  },

  commitViewport: (vp) => {
    if (viewportNearlyEqual(get().viewport, vp)) return;
    recordBeforeDiscreteMutation(get);
    set({ viewport: vp });
    if (get().projectPath) scheduleSave(get);
  },

  groupSelectedNodes: () => {
    const { selectedNodeIds, nodes } = get();
    if (selectedNodeIds.length < 2) return;
    recordBeforeDiscreteMutation(get);
    const selected = nodes.filter((n) => selectedNodeIds.includes(n.id));
    const xs = selected.map((n) => n.position.x);
    const ys = selected.map((n) => n.position.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    const groupId = crypto.randomUUID();
    const groupNode: Node<FlowNodeData> = {
      id: groupId,
      type: "group",
      position: { x: minX - 40, y: minY - 40 },
      style: {
        width: Math.max(260, maxX - minX + 260),
        height: Math.max(220, maxY - minY + 220),
        border: "1px dashed #4b5563",
        borderRadius: "12px",
        background: "rgba(59,130,246,0.05)",
      },
      data: { label: "工作流分组" },
      draggable: true,
      selectable: true,
    };

    const nextNodes = [
      ...nodes.map((n) =>
        selectedNodeIds.includes(n.id)
          ? {
              ...n,
              parentId: groupId,
              extent: "parent" as const,
              position: {
                x: n.position.x - (minX - 40),
                y: n.position.y - (minY - 40),
              },
            }
          : n,
      ),
      groupNode,
    ];
    set({ nodes: nextNodes, selectedNodeIds: [groupId], selectedNodeId: groupId });
    if (get().projectPath) scheduleSave(get);
  },

  selectNodesByIds: (ids) => {
    const idSet = new Set(ids);
    set((s) => ({
      nodes: s.nodes.map((n) => ({ ...n, selected: idSet.has(n.id) })),
      selectedNodeIds: ids,
      selectedNodeId: ids[0] ?? null,
      selectedEdgeIds: [],
    }));
  },

  arrangeSelectedNodes: (mode) => {
    const { selectedNodeIds, nodes } = get();
    const movable = selectedNodeIds
      .map((id) => nodes.find((n) => n.id === id))
      .filter((n): n is Node<FlowNodeData> => Boolean(n && !n.parentId));
    if (movable.length < 2) {
      get().setStatusText("请框选至少两个未嵌套的节点再排列");
      return;
    }
    recordBeforeDiscreteMutation(get);
    const gap = CANVAS_NODE_LAYOUT_GAP;
    const sorted = [...movable].sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
    const dims = sorted.map((n) => nodeLayoutDimensions(n));
    const baseX = Math.min(...sorted.map((n) => n.position.x));
    const baseY = Math.min(...sorted.map((n) => n.position.y));
    const nextPos = new Map<string, { x: number; y: number }>();
    if (mode === "horizontal") {
      let x = baseX;
      sorted.forEach((n, i) => {
        const { w } = dims[i]!;
        nextPos.set(n.id, { x, y: baseY });
        x += w + gap;
      });
    } else if (mode === "vertical") {
      let y = baseY;
      sorted.forEach((n, i) => {
        const { h } = dims[i]!;
        nextPos.set(n.id, { x: baseX, y });
        y += h + gap;
      });
    } else {
      const cols = Math.ceil(Math.sqrt(sorted.length));
      const maxW = Math.max(...dims.map((d) => d.w));
      const maxH = Math.max(...dims.map((d) => d.h));
      const cellW = maxW + gap;
      const cellH = maxH + gap;
      sorted.forEach((n, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        nextPos.set(n.id, {
          x: baseX + col * cellW,
          y: baseY + row * cellH,
        });
      });
    }
    set((s) => ({
      nodes: s.nodes.map((n) => {
        const p = nextPos.get(n.id);
        return p ? { ...n, position: p } : n;
      }),
    }));
    if (get().projectPath) scheduleSave(get);
  },

  importMediaFiles: async (filePaths, position) => {
    if (!isTauri()) {
      set({ statusText: DESKTOP_SHELL_HINT });
      return;
    }
    const { projectPath } = get();
    if (!projectPath) {
      set({ statusText: "请先新建或打开工程目录后再导入素材。" });
      return;
    }
    if (filePaths.length === 0) return;
    try {
      const supportedExt = new Set([
        "png",
        "jpg",
        "jpeg",
        "webp",
        "bmp",
        "gif",
        "mp4",
        "mov",
        "webm",
        "avi",
        "mkv",
        "mp3",
        "wav",
        "m4a",
        "flac",
        "ogg",
      ]);
      const accepted = filePaths.filter((p) => {
        const ext = p.split(".").pop()?.toLowerCase() ?? "";
        return supportedExt.has(ext);
      });
      const skipped = filePaths.length - accepted.length;
      if (accepted.length === 0) {
        set({ statusText: "导入失败：仅支持图片/视频/音频文件格式" });
        return;
      }

      const items = await importMediaFilesApi(projectPath, accepted);
      recordBeforeDiscreteMutation(get);
      const baseX = position?.x ?? 180;
      const baseY = position?.y ?? 180;
      const dropPositions = computeBatchImportDropPositions(items.length, { x: baseX, y: baseY });
      const nodes = items.map((item, idx) => {
        const rel = item.relPath;
        const ext = rel.split(".").pop()?.toLowerCase() ?? "";
        const type = ["png", "jpg", "jpeg", "webp", "bmp", "gif"].includes(ext)
          ? "imageNode"
          : ["mp4", "mov", "webm", "avi", "mkv"].includes(ext)
            ? "videoNode"
            : ["mp3", "wav", "m4a", "flac", "ogg"].includes(ext)
              ? "audioNode"
              : "mediaImport";
        const defaultLabel =
          type === "imageNode"
            ? "图片"
            : type === "videoNode"
              ? "视频"
              : type === "audioNode"
                ? "音频"
                : type === "mediaImport"
                  ? "媒体导入"
                  : undefined;
        const pos = dropPositions[idx] ?? { x: baseX, y: baseY };
        return {
          id: crypto.randomUUID(),
          type,
          position: pos,
          data: {
            path: rel,
            assetId: item.assetId,
            ...(defaultLabel ? { label: defaultLabel } : {}),
          },
        } as Node<FlowNodeData>;
      });
      set((s) => ({
        nodes: [...s.nodes, ...nodes],
        statusText:
          skipped > 0
            ? `已导入 ${nodes.length} 个，跳过 ${skipped} 个不支持文件`
            : `已导入素材 ${nodes.length} 个`,
      }));
      if (nodes.length > 0) {
        get().setSelectedNodeIds(nodes.map((n) => n.id));
      }
      scheduleSave(get);
    } catch (e) {
      set({ statusText: `导入失败：${formatUserError(e)}` });
    }
  },

  assignImportedMediaToNode: async (nodeId, filePaths) => {
    if (!isTauri()) {
      set({ statusText: DESKTOP_SHELL_HINT });
      return;
    }
    const { projectPath } = get();
    if (!projectPath) {
      set({ statusText: "请先新建或打开工程目录后再上传素材。" });
      return;
    }
    if (filePaths.length === 0) return;
    try {
      const items = await importMediaFilesApi(projectPath, filePaths);
      const first = items[0];
      if (!first) {
        set({ statusText: "导入未返回有效路径" });
        return;
      }
      get().updateNodeData(nodeId, { path: first.relPath, assetId: first.assetId });
      set({ statusText: `已绑定素材：${first.relPath}` });
    } catch (e) {
      set({ statusText: `上传失败：${formatUserError(e)}` });
    }
  },

  addReferenceImageNodeLeftOf: async (targetImageNodeId, filePaths) => {
    if (!isTauri()) {
      set({ statusText: DESKTOP_SHELL_HINT });
      return;
    }
    const { projectPath } = get();
    if (!projectPath) {
      set({ statusText: "请先新建或打开工程目录后再添加左侧参考图。" });
      return;
    }
    if (filePaths.length === 0) return;
    const target = get().nodes.find((n) => n.id === targetImageNodeId && n.type === "imageNode");
    if (!target) return;
    try {
      const items = await importMediaFilesApi(projectPath, filePaths);
      const first = items[0];
      if (!first) {
        set({ statusText: "导入未返回有效路径" });
        return;
      }
      const rel = first.relPath;
      const state = get();
      const y = computeNextLeftInputY(state.nodes, state.edges, targetImageNodeId, target.position.y);
      const x = leftInputColumnX(target.position.x);
      const newId = crypto.randomUUID();
      recordBeforeDiscreteMutation(get);
      set((s) => ({
        nodes: [
          ...s.nodes,
          {
            id: newId,
            type: "imageNode",
            position: { x, y },
            data: {
              ...newNodeDataByType.imageNode(),
              label: "输入",
              path: rel,
              assetId: first.assetId,
            },
          },
        ],
        edges: [...s.edges, makeFlowEdge(newId, targetImageNodeId, "imageNode")],
      }));
      if (get().projectPath) scheduleSave(get);
      get().setSelectedNodeIds([newId]);
      set({ statusText: `已在左侧添加参考图节点：${rel}` });
    } catch (e) {
      set({ statusText: `上传失败：${formatUserError(e)}` });
    }
  },

  copySelection: () => {
    const { selectedNodeIds, nodes, edges } = get();
    if (selectedNodeIds.length === 0) return;
    const cn = nodes
      .filter((n) => selectedNodeIds.includes(n.id))
      .map((n) => ({ ...n, data: cloneFlowNodeData(n.data) }));
    const ce = edges
      .filter((e) => selectedNodeIds.includes(e.source) && selectedNodeIds.includes(e.target))
      .map((e) => JSON.parse(JSON.stringify(e)) as Edge);
    setFlowClipboard(cn, ce);
    set({ statusText: `已复制 ${cn.length} 个`, flowClipboardCount: cn.length });
  },

  pasteSelection: () => {
    const { nodes: copiedNodes, edges: copiedEdges } = getFlowClipboard();
    if (copiedNodes.length === 0) return;
    recordBeforeDiscreteMutation(get);
    const { nextNodes, idMap } = buildPasteNodesFromClipboard({
      copiedNodes,
      copiedEdges,
    });
    const nextEdges = buildPasteEdgesFromClipboard(copiedEdges, idMap, nextNodes);
    set((s) => ({
      nodes: [...s.nodes, ...nextNodes],
      edges: [...s.edges, ...nextEdges],
      selectedNodeIds: nextNodes.map((n) => n.id),
      selectedNodeId: nextNodes[0]?.id ?? null,
      statusText: `已粘贴 ${nextNodes.length} 个`,
    }));
    if (get().projectPath) scheduleSave(get);
  },

  deleteSelection: () => {
    const { selectedNodeIds, selectedEdgeIds } = get();
    if (selectedNodeIds.length === 0 && selectedEdgeIds.length === 0) return;
    recordBeforeDiscreteMutation(get);
    set((s) => ({
      nodes: s.nodes.filter((n) => !selectedNodeIds.includes(n.id)),
      edges: s.edges.filter(
        (e) =>
          !selectedNodeIds.includes(e.source) &&
          !selectedNodeIds.includes(e.target) &&
          !selectedEdgeIds.includes(e.id),
      ),
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectedNodeId: null,
      statusText: `已删除 ${selectedNodeIds.length} 个，${selectedEdgeIds.length} 条连线`,
    }));
    if (get().projectPath) scheduleSave(get);
  },

  toggleSelectedEdgesDisabled: (disabled) => {
    const { selectedEdgeIds } = get();
    if (selectedEdgeIds.length === 0) return;
    recordBeforeDiscreteMutation(get);
    set((s) => ({
      edges: s.edges.map((e) =>
        selectedEdgeIds.includes(e.id)
          ? {
              ...e,
              data: {
                ...(typeof e.data === "object" && e.data ? e.data : {}),
                disabled,
              },
            }
          : e,
      ),
      statusText: edgeToggleStatusText(disabled, selectedEdgeIds.length),
    }));
    if (get().projectPath) scheduleSave(get);
  },

  undo: () => runUndo(get, set),

  redo: () => runRedo(get, set),
}));
