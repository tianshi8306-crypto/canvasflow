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
import { computeNextLeftInputY, leftInputColumnX } from "@/lib/videoInputNodeLayout";
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
  hasParallelEdge,
  isConnectionAllowed,
  normalizeConnection,
  sanitizeCanvasEdges,
  validateConnection,
} from "@/lib/flowConnectionPolicy";
import { applyTextWorkflowSyncToNodes } from "@/lib/textNodeWorkflowSync";
import { makeFlowEdge } from "@/lib/flowEdge";
import { edgeToggleStatusText, isEdgeDisabled } from "@/lib/edgeState";
import {
  buildPasteEdgesFromClipboard,
  buildPasteNodesFromClipboard,
} from "@/lib/buildPasteNodesFromClipboard";
import { cloneFlowNodeData } from "@/lib/flowNodeDataClone";
import { defaultViewport, parseCanvas, serializeCanvas } from "@/lib/serialization";
import type { FlowNodeData } from "@/lib/types";
import { importMediaFiles as importMediaFilesApi } from "@/shared/api/assets";
import { defaultVideoGenerationDraft, defaultVideoNodePersisted } from "@/lib/videoNodeTypes";
import {
  buildComposeClipsFromScript,
  DEFAULT_EXPORT_PATH,
  findConcatNodeForScriptVideos,
  formatComposeMissingHint,
} from "@/lib/compose";
import { orderedIncomingScriptNodeIds } from "@/lib/incomingScriptBinding";
import { extractVideoAudioToAssets } from "@/lib/videoToolbarAudioExtract";
import { delogoVideoToAssets } from "@/lib/videoToolbarDelogo";
import { defaultVideoSourceTrim, normalizeVideoSourceTrim } from "@/lib/videoSourceTrim";
import { trimVideoToAssets } from "@/lib/videoToolbarTrim";
import {
  mergeDraftForVideoToolbarWorkflow,
  type VideoToolbarWorkflowMode,
} from "@/lib/videoToolbarWorkflow";
import type { VideoSourceTrim, VideoSubtitleRegion } from "@/lib/videoNodeTypes";
import {
  defaultVideoSubtitleRegion,
  normalizeVideoSubtitleRegion,
} from "@/lib/videoSubtitleRegion";
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
import { rebuildShotNodeRegistry } from "@/lib/hermes";

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
  /** 图片节点序号计数器，每个工程独立（用于 "图片 1", "图片 2" ...） */
  imageNodeCounter: 0,
  videoNodeCounter: 0,

  /** 获取并递增下一个图片节点序号标签，如 "图片 1" */
  nextImageNodeLabel: () => {
    const n = get().imageNodeCounter + 1;
    set({ imageNodeCounter: n });
    return `图片 ${n}`;
  },

  /** 获取并递增下一个视频节点序号标签，如 "视频 1" */
  nextVideoNodeLabel: () => {
    const n = get().videoNodeCounter + 1;
    set({ videoNodeCounter: n });
    return `视频 ${n}`;
  },

  setProjectPath: (p) => set({ projectPath: p }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setSelectedNodeIds: (ids) => set({ selectedNodeIds: ids, selectedNodeId: ids[0] ?? null }),
  setSelectedEdgeIds: (ids) => set({ selectedEdgeIds: ids }),
  setStatusText: (t) => set({ statusText: t }),
  setViewport: (v) => set({ viewport: v }),
  openScriptFullscreen: (nodeId) => set({ scriptFullscreenNodeId: nodeId }),
  closeScriptFullscreen: () => set({ scriptFullscreenNodeId: null }),
  setLastRunId: (runId: string) => set({ lastRunId: runId }),

  onNodesChange: (changes) => {
    scheduleHistoryBurst(get);
    const nodes = get().nodes;
    const ui = useCanvasUiStore.getState();
    const snapOn = ui.nodeSnapAlignmentEnabled;
    const typedChanges = changes as NodeChange<Node<FlowNodeData>>[];
    let nextChanges = typedChanges;
    if (snapOn) {
      const snapped = snapNodePositionChanges(typedChanges, nodes);
      nextChanges = snapped.changes;
      ui.setNodeSnapVisual(snapped.visual);
    } else {
      ui.setNodeSnapVisual(null);
    }
    const dragEnded = typedChanges.some(
      (c) => c.type === "position" && (c as { dragging?: boolean }).dragging === false,
    );
    if (dragEnded) {
      ui.setNodeSnapVisual(null);
    }
    set((s) => ({ nodes: applyNodeChanges(nextChanges, s.nodes) }));
    if (get().projectPath) scheduleSave(get);
  },
  onEdgesChange: (changes) => {
    scheduleHistoryBurst(get);
    set((s) => {
      const edges = applyEdgeChanges(changes, s.edges);
      const nodes = applyTextWorkflowSyncToNodes(s.nodes, edges);
      return { edges, nodes };
    });
    if (get().projectPath) scheduleSave(get);
  },
  onConnect: (c) => {
    const nodes = get().nodes;
    const edges = get().edges;
    const normalized = normalizeConnection(c);
    if (hasParallelEdge(edges, normalized)) {
      set({ statusText: "已取消连线：相同节点之间已存在连线" });
      return;
    }
    const verdict = validateConnection(normalized, nodes, edges);
    if (!verdict.ok) {
      set({ statusText: `已取消连线：${verdict.reason}` });
      return;
    }
    const sn = nodes.find((n) => n.id === normalized.source);
    if (!sn) return;
    const payloadType = getOutputPortType(sn.type);
    recordBeforeDiscreteMutation(get);
    set((s) => {
      const edges = addEdge(
        {
          ...normalized,
          sourceHandle: normalized.sourceHandle ?? "out",
          targetHandle: normalized.targetHandle ?? "in",
          id: crypto.randomUUID(),
          animated: true,
          style: { strokeWidth: 2, stroke: "#60a5fa" },
          ...(payloadType ? { data: { payloadType } } : {}),
        },
        s.edges,
      );
      const nodes = applyTextWorkflowSyncToNodes(s.nodes, edges);
      return { edges, nodes };
    });
    if (get().projectPath) scheduleSave(get);
  },

  deleteEdge: (edgeId) => {
    recordBeforeDiscreteMutation(get);
    set((s) => {
      const edges = s.edges.filter((e) => e.id !== edgeId);
      const nodes = applyTextWorkflowSyncToNodes(s.nodes, edges);
      return { edges, nodes };
    });
    if (get().projectPath) scheduleSave(get);
  },

  updateNodeData: (id, patch, opts) => {
    if (!opts?.silent) recordBeforeDiscreteMutation(get);
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
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
        imageNodeCounter: 0,
        videoNodeCounter: 0,
      });
      // 新建工程时清空 Hermes shotNodeRegistry
      rebuildShotNodeRegistry([]);
      useCanvasUiStore
        .getState()
        .addTab({
          name: folder.split(/[/\\]/).pop() ?? "新画布",
          projectPath: folder,
          unsaved: false,
          nodes: [],
          edges: [],
          viewport: defaultViewport,
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
        const { nodes, edges, viewport, invalidEdgesDropped, meta } = parseCanvas(raw);
        clearHistoryStacks();
        const statusBase = `工程：${folder}`;
        // 计算已有图片节点数量，用于序号递增
        const maxImgIdx = nodes
          .filter((n) => n.type === "imageNode")
          .reduce((acc, n) => {
            const m = String(n.data.label ?? "").match(/^图片\s*(\d+)$/);
            return Math.max(acc, m ? parseInt(m[1], 10) : 0);
          }, 0);
        const maxVidIdx = nodes
          .filter((n) => n.type === "videoNode")
          .reduce((acc, n) => {
            const m = String(n.data.label ?? "").match(/^视频\s*(\d+)$/);
            return Math.max(acc, m ? parseInt(m[1], 10) : 0);
          }, 0);
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
          imageNodeCounter: meta?.imageNodeCounter != null ? meta.imageNodeCounter : maxImgIdx,
          videoNodeCounter: meta?.videoNodeCounter != null ? meta.videoNodeCounter : maxVidIdx,
        });
        // 重建 Hermes shotNodeRegistry，确保工程重开后状态联动仍有效
        rebuildShotNodeRegistry(nodes);
        useCanvasUiStore
          .getState()
          .addTab({
            name: folder.split(/[/\\]/).pop() ?? "新画布",
            projectPath: folder,
            unsaved: false,
            nodes: [],
            edges: [],
            viewport: defaultViewport,
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
          imageNodeCounter: 0,
          videoNodeCounter: 0,
        });
        useCanvasUiStore
          .getState()
          .addTab({
            name: folder.split(/[/\\]/).pop() ?? "新画布",
            projectPath: folder,
            unsaved: false,
            nodes: [],
            edges: [],
            viewport: defaultViewport,
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
    const { projectPath, nodes, edges, viewport, imageNodeCounter, videoNodeCounter } = get();
    if (!projectPath) return;
    try {
      const content = serializeCanvas(nodes, edges, viewport, {
        imageNodeCounter,
        videoNodeCounter,
      });
      await invoke("write_canvasflow_json", { projectPath, content });
      set({ lastSavedAt: Date.now() });
      const { tabs } = useCanvasUiStore.getState();
      const tab = tabs.find((t) => t.projectPath === projectPath);
      if (tab) {
        useCanvasUiStore.getState().updateTabUnsaved(tab.id, false);
      }
    } catch (e) {
      set({ statusText: `保存失败：${formatUserError(e)}` });
    }
  },

  saveProjectAs: async () => {
    if (!isTauri()) {
      set({ statusText: DESKTOP_SHELL_HINT });
      return;
    }
    const { nodes, edges, viewport, imageNodeCounter, videoNodeCounter } = get();
    try {
      const folder = await invoke<string | null>("pick_project_folder");
      if (!folder) return;
      await invoke("ensure_project_structure", { projectPath: folder });
      const content = serializeCanvas(nodes, edges, viewport, {
        imageNodeCounter,
        videoNodeCounter,
      });
      await invoke("write_canvasflow_json", { projectPath: folder, content });
      clearHistoryStacks();
      set({
        projectPath: folder,
        lastSavedAt: Date.now(),
        lastRunId: null,
        nodeRunStateById: {},
        statusText: `工程：${folder}`,
      });
      await focusShellAfterNativeDialog();
    } catch (e) {
      set({ statusText: `另存为失败：${formatUserError(e)}` });
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
    const pending = useCanvasUiStore.getState().pendingAnchorConnection;
    const defaultPos =
      direction === "incoming"
        ? { x: anchor.position.x - gap, y: anchor.position.y }
        : { x: anchor.position.x + gap, y: anchor.position.y };
    const partnerW = partnerType === "imageNode" ? 500 : 320;
    const partnerH = partnerType === "imageNode" ? 281 : 200;
    const pos =
      pending?.anchorNodeId === anchorNodeId
        ? {
            x: pending.releaseFlow.x - partnerW / 2,
            y: pending.releaseFlow.y - partnerH / 2,
          }
        : defaultPos;
    const newNode: Node<FlowNodeData> = {
      id: newId,
      type: partnerType,
      position: pos,
      data:
        partnerType === "imageNode"
          ? { ...factory(), label: get().nextImageNodeLabel() }
          : factory(),
    };
    const edge =
      direction === "incoming"
        ? makeFlowEdge(newId, anchorNodeId, partnerType)
        : makeFlowEdge(anchorNodeId, newId, anchor.type ?? undefined);
    if (hasParallelEdge(state.edges, edge)) {
      set({ statusText: "无法创建连线：相同节点之间已存在连线" });
      return;
    }
    const verdict = validateConnection(
      {
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? null,
        targetHandle: edge.targetHandle ?? null,
      },
      state.nodes,
      state.edges,
    );
    if (!verdict.ok) {
      set({ statusText: `无法创建连线：${verdict.reason}` });
      return;
    }
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
          n.id === videoNodeId ? { ...n, data: { ...n.data, video: buildMergedVideo(paths) } } : n,
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
          n.id === videoNodeId ? { ...n, data: { ...n.data, video: buildMergedVideo(paths) } } : n,
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
        data: { ...newNodeDataByType.imageNode(), label: get().nextImageNodeLabel() },
      };
    } else if (kind === "referenceVideo") {
      node = {
        id: newId,
        type: "videoNode",
        position: { x, y },
        data: { ...newNodeDataByType.videoNode(), label: get().nextVideoNodeLabel() },
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

  openVideoClipConcat: (videoNodeId) => {
    const state = get();
    const vNode = state.nodes.find((n) => n.id === videoNodeId && n.type === "videoNode");
    if (!vNode) return;
    if (!vNode.data.path?.trim() && !vNode.data.assetId?.trim()) {
      get().setStatusText("请先上传或生成视频后再剪辑");
      return;
    }

    const existingEdge = state.edges.find((e) => {
      if (e.source !== videoNodeId) return false;
      const t = state.nodes.find((n) => n.id === e.target);
      return t?.type === "ffmpegConcat";
    });
    if (existingEdge) {
      const concatId = existingEdge.target;
      get().setSelectedNodeIds([concatId]);
      get().setStatusText("已选中右侧视频合成节点，可添加片段并导出");
      return;
    }

    const gap = 80;
    const videoW =
      typeof vNode.measured?.width === "number" && vNode.measured.width > 0
        ? vNode.measured.width
        : 500;
    const concatId = crypto.randomUUID();
    const baseLabel = vNode.data.label?.trim() || "视频";
    const videoPath = vNode.data.path?.trim() ?? "";

    const concatNode: Node<FlowNodeData> = {
      id: concatId,
      type: "ffmpegConcat",
      position: { x: vNode.position.x + videoW + gap, y: vNode.position.y },
      data: {
        ...newNodeDataByType.ffmpegConcat(),
        label: `${baseLabel} · 剪辑`,
        inputs: videoPath ? [videoPath] : [],
        output: "assets/exports/final.mp4",
      },
    };

    recordBeforeDiscreteMutation(get);
    set((s) => ({
      nodes: [...s.nodes, concatNode],
      edges: [...s.edges, makeFlowEdge(videoNodeId, concatId, "videoNode")],
    }));
    scheduleSave(get);
    get().setSelectedNodeIds([concatId]);
    get().setStatusText("已创建视频合成节点：可继续连接更多视频并导出成片");
  },

  exportScriptCompose: async (scriptNodeId, opts) => {
    const autoRender = opts?.autoRender !== false;
    const state = get();
    const projectPath = state.projectPath;
    if (!projectPath) {
      get().setStatusText("请先打开工程");
      return null;
    }

    const scriptNode = state.nodes.find((n) => n.id === scriptNodeId && n.type === "scriptNode");
    if (!scriptNode) {
      get().setStatusText("未找到脚本节点");
      return null;
    }

    const built = await buildComposeClipsFromScript({
      scriptNodeId,
      beats: scriptNode.data.scriptBeats ?? [],
      shots: scriptNode.data.storyboardShots ?? [],
      nodes: state.nodes,
      edges: state.edges,
      projectPath,
      beatIds: opts?.beatIds,
    });

    const scriptLabel = scriptNode.data.label?.trim() || "脚本";
    const outputRel = DEFAULT_EXPORT_PATH;

    let concatId = findConcatNodeForScriptVideos(state.nodes, state.edges, built.videoNodeIds);
    let createdConcat = false;

    const ensureEdgesToConcat = (concatTargetId: string, baseEdges: Edge[]) => {
      const next = [...baseEdges];
      for (const clip of built.clips) {
        const exists = next.some((e) => e.source === clip.sourceNodeId && e.target === concatTargetId);
        if (!exists) {
          next.push(makeFlowEdge(clip.sourceNodeId, concatTargetId, "videoNode"));
        }
      }
      return next;
    };

    if (!concatId) {
      createdConcat = true;
      concatId = crypto.randomUUID();
      const gap = 80;
      const scriptW =
        typeof scriptNode.measured?.width === "number" && scriptNode.measured.width > 0
          ? scriptNode.measured.width
          : 420;

      const concatNode: Node<FlowNodeData> = {
        id: concatId,
        type: "ffmpegConcat",
        position: { x: scriptNode.position.x + scriptW + gap, y: scriptNode.position.y },
        data: {
          ...newNodeDataByType.ffmpegConcat(),
          label: `${scriptLabel} · 成片`,
          inputs: built.clipPaths,
          output: outputRel,
        },
      };

      recordBeforeDiscreteMutation(get);
      set((s) => ({
        nodes: [...s.nodes, concatNode],
        edges: ensureEdgesToConcat(concatId, s.edges),
      }));
    } else {
      recordBeforeDiscreteMutation(get);
      const cur = get();
      const nextEdges = ensureEdgesToConcat(concatId, cur.edges);
      if (nextEdges.length !== cur.edges.length) {
        set({ edges: nextEdges });
      }
      get().updateNodeData(concatId, {
        inputs: built.clipPaths,
        output: outputRel,
      });
    }

    scheduleSave(get);
    get().setSelectedNodeIds([concatId]);

    let outputRelPath: string | undefined;
    if (autoRender && built.clipPaths.length > 0) {
      try {
        outputRelPath = await invoke<string>("render_timeline", {
          projectPath,
          clips: built.clipPaths,
          outputRelPath: outputRel,
        });
        get().updateNodeData(concatId, { output: outputRelPath, path: outputRelPath });
      } catch (e) {
        const missHint = formatComposeMissingHint(built.missing);
        get().setStatusText(`成片导出失败：${formatUserError(e)}${missHint}`);
        return {
          concatNodeId: concatId,
          clipPaths: built.clipPaths,
          missing: built.missing,
          createdConcat,
        };
      }
    }

    const missHint = formatComposeMissingHint(built.missing);
    if (outputRelPath) {
      get().setStatusText(
        `成片已导出：${outputRelPath}（${built.clipPaths.length} 段${missHint}）`,
      );
    } else if (built.clipPaths.length === 0) {
      get().setStatusText(`没有可导出的视频片段${missHint}；已打开合成节点`);
    } else {
      get().setStatusText(
        `已填入 ${built.clipPaths.length} 段片段${missHint}；可在合成节点继续调整并导出`,
      );
    }

    return {
      concatNodeId: concatId,
      clipPaths: built.clipPaths,
      missing: built.missing,
      outputRelPath,
      createdConcat,
    };
  },

  openVideoToolbarWorkflow: (videoNodeId, mode: VideoToolbarWorkflowMode) => {
    const state = get();
    const vNode = state.nodes.find((n) => n.id === videoNodeId && n.type === "videoNode");
    if (!vNode) return;

    const videoPath = vNode.data.path?.trim() ?? "";
    if (!videoPath && !vNode.data.assetId?.trim()) {
      get().setStatusText("请先上传或生成视频");
      return;
    }
    if (!videoPath) {
      get().setStatusText("素材路径未就绪，请稍候或重新导入视频");
      return;
    }

    const curVideo = vNode.data.video ?? defaultVideoNodePersisted();
    const nextDraft = mergeDraftForVideoToolbarWorkflow(
      curVideo.draft ?? defaultVideoGenerationDraft(),
      videoPath,
      mode,
    );

    recordBeforeDiscreteMutation(get);
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === videoNodeId
          ? {
              ...n,
              data: {
                ...n.data,
                video: { ...defaultVideoNodePersisted(), ...curVideo, draft: nextDraft },
              },
            }
          : n,
      ),
    }));
    scheduleSave(get);
    get().setSelectedNodeIds([videoNodeId]);

    const hasScriptUpstream =
      orderedIncomingScriptNodeIds(state.nodes, state.edges, videoNodeId).length > 0;
    if (mode === "parse") {
      get().setStatusText(
        hasScriptUpstream
          ? "已打开解析：参考视频模式；可对照上游脚本分镜编辑提示词后生成"
          : "已打开解析：参考视频模式，请在底栏补充或修改提示词后生成",
      );
      return;
    }
    if (mode === "subtitle-auto") {
      get().setStatusText(
        "已打开去字幕：参考视频模式，请选模型后生成（专用去字幕 API 待接，效果取决于模型）",
      );
      return;
    }
    get().setStatusText(
      "已打开高清：参考视频 + 1080P，请选支持的视频模型后生成（效果取决于模型）",
    );
  },

  enterVideoTrimMode: (videoNodeId) => {
    const vNode = get().nodes.find((n) => n.id === videoNodeId && n.type === "videoNode");
    if (!vNode) return;
    const videoPath = vNode.data.path?.trim() ?? "";
    if (!videoPath && !vNode.data.assetId?.trim()) {
      get().setStatusText("请先上传或生成视频后再裁剪");
      return;
    }
    useCanvasUiStore.getState().setVideoSubtitleRegionEditingNodeId(null);
    get().setSelectedNodeIds([videoNodeId]);
    get().setStatusText("裁剪模式：拖动进度条两端选择区间，再点「导出裁剪」");
  },

  enterVideoSubtitleRegionMode: (videoNodeId) => {
    const vNode = get().nodes.find((n) => n.id === videoNodeId && n.type === "videoNode");
    if (!vNode) return;
    const videoPath = vNode.data.path?.trim() ?? "";
    if (!videoPath && !vNode.data.assetId?.trim()) {
      get().setStatusText("请先上传或生成视频后再框选去字幕");
      return;
    }
    useCanvasUiStore.getState().setVideoTrimEditingNodeId(null);
    get().setSelectedNodeIds([videoNodeId]);
    get().setStatusText("框选字幕区域：拖动调整选区，完成后点「保存选区」");
  },

  patchVideoSubtitleRegion: (videoNodeId, region) => {
    const vNode = get().nodes.find((n) => n.id === videoNodeId && n.type === "videoNode");
    if (!vNode) return;
    const curVideo = vNode.data.video ?? defaultVideoNodePersisted();
    const w = curVideo.sourceWidth ?? 0;
    const h = curVideo.sourceHeight ?? 0;
    const nextRegion: VideoSubtitleRegion =
      w > 0 && h > 0 ? normalizeVideoSubtitleRegion(region) : region;

    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === videoNodeId
          ? {
              ...n,
              data: {
                ...n.data,
                video: { ...defaultVideoNodePersisted(), ...curVideo, subtitleRegion: nextRegion },
              },
            }
          : n,
      ),
    }));
    scheduleSave(get);
  },

  patchVideoSourceTrim: (videoNodeId, trim) => {
    const vNode = get().nodes.find((n) => n.id === videoNodeId && n.type === "videoNode");
    if (!vNode) return;
    const curVideo = vNode.data.video ?? defaultVideoNodePersisted();
    const duration = curVideo.sourceDurationSec;
    const nextTrim: VideoSourceTrim =
      duration && duration > 0 ? normalizeVideoSourceTrim(trim, duration) : trim;

    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === videoNodeId
          ? {
              ...n,
              data: {
                ...n.data,
                video: { ...defaultVideoNodePersisted(), ...curVideo, sourceTrim: nextTrim },
              },
            }
          : n,
      ),
    }));
    scheduleSave(get);
  },

  setVideoSourceMeta: (videoNodeId, meta) => {
    const { durationSec, width, height } = meta;
    if (!Number.isFinite(durationSec) || durationSec <= 0) return;
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return;

    const vNode = get().nodes.find((n) => n.id === videoNodeId && n.type === "videoNode");
    if (!vNode) return;
    const curVideo = vNode.data.video ?? defaultVideoNodePersisted();
    if (
      curVideo.sourceDurationSec === durationSec &&
      curVideo.sourceWidth === width &&
      curVideo.sourceHeight === height &&
      curVideo.sourceTrim &&
      curVideo.subtitleRegion
    ) {
      return;
    }
    const nextTrim = curVideo.sourceTrim
      ? normalizeVideoSourceTrim(curVideo.sourceTrim, durationSec)
      : defaultVideoSourceTrim(durationSec);
    const nextRegion = curVideo.subtitleRegion
      ? normalizeVideoSubtitleRegion(curVideo.subtitleRegion)
      : defaultVideoSubtitleRegion();

    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === videoNodeId
          ? {
              ...n,
              data: {
                ...n.data,
                video: {
                  ...defaultVideoNodePersisted(),
                  ...curVideo,
                  sourceDurationSec: durationSec,
                  sourceWidth: width,
                  sourceHeight: height,
                  sourceTrim: nextTrim,
                  subtitleRegion: nextRegion,
                },
              },
            }
          : n,
      ),
    }));
    scheduleSave(get);
  },

  exportVideoSubtitleDelogo: async (videoNodeId) => {
    if (!isTauri()) {
      get().setStatusText(DESKTOP_SHELL_HINT);
      return;
    }
    const { projectPath, nodes } = get();
    if (!projectPath?.trim()) {
      get().setStatusText("请先新建或打开工程目录");
      return;
    }
    const vNode = nodes.find((n) => n.id === videoNodeId && n.type === "videoNode");
    if (!vNode) return;
    const relPath = vNode.data.path?.trim();
    const curVideo = vNode.data.video ?? defaultVideoNodePersisted();
    const region = curVideo.subtitleRegion;
    const sw = curVideo.sourceWidth ?? 0;
    const sh = curVideo.sourceHeight ?? 0;
    if (!relPath) {
      get().setStatusText("请先上传或生成视频");
      return;
    }
    if (!region) {
      get().setStatusText("请先框选字幕区域");
      return;
    }
    if (sw <= 0 || sh <= 0) {
      get().setStatusText("请等待视频加载完成后再应用去字幕");
      return;
    }

    const normalized = normalizeVideoSubtitleRegion(region);
    get().patchVideoSubtitleRegion(videoNodeId, normalized);

    get().setStatusText("正在去字幕（本地处理）…");
    try {
      const imported = await delogoVideoToAssets(projectPath, relPath, normalized, sw, sh);
      recordBeforeDiscreteMutation(get);
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === videoNodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  path: imported.rel_path,
                  assetId: imported.asset_id,
                  video: {
                    ...defaultVideoNodePersisted(),
                    ...curVideo,
                    source: "upload",
                    subtitleRegion: undefined,
                    sourceWidth: undefined,
                    sourceHeight: undefined,
                    sourceDurationSec: undefined,
                    sourceTrim: undefined,
                  },
                },
              }
            : n,
        ),
      }));
      scheduleSave(get);
      useCanvasUiStore.getState().setVideoSubtitleRegionEditingNodeId(null);
      const base = imported.rel_path.split(/[/\\]/).pop() ?? imported.rel_path;
      get().setStatusText(`已去字幕：${base}（已替换节点成片；固定区域修复，滚动字幕请用「自动去除」）`);
    } catch (e) {
      get().setStatusText(formatUserError(e));
    }
  },

  exportVideoTrim: async (videoNodeId) => {
    if (!isTauri()) {
      get().setStatusText(DESKTOP_SHELL_HINT);
      return;
    }
    const { projectPath, nodes } = get();
    if (!projectPath?.trim()) {
      get().setStatusText("请先新建或打开工程目录");
      return;
    }
    const vNode = nodes.find((n) => n.id === videoNodeId && n.type === "videoNode");
    if (!vNode) return;
    const relPath = vNode.data.path?.trim();
    const curVideo = vNode.data.video ?? defaultVideoNodePersisted();
    const duration = curVideo.sourceDurationSec ?? 0;
    const trim = curVideo.sourceTrim;
    if (!relPath) {
      get().setStatusText("请先上传或生成视频");
      return;
    }
    if (!trim || duration <= 0) {
      get().setStatusText("请等待视频加载完成并设置裁剪区间");
      return;
    }
    const normalized = normalizeVideoSourceTrim(trim, duration);
    if (normalized.outSec - normalized.inSec < 0.05) {
      get().setStatusText("裁剪片段过短");
      return;
    }

    get().setStatusText("正在导出裁剪…");
    try {
      const imported = await trimVideoToAssets(projectPath, relPath, normalized);
      recordBeforeDiscreteMutation(get);
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === videoNodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  path: imported.rel_path,
                  assetId: imported.asset_id,
                  video: {
                    ...defaultVideoNodePersisted(),
                    ...curVideo,
                    source: "upload",
                    sourceTrim: undefined,
                    sourceDurationSec: undefined,
                  },
                },
              }
            : n,
        ),
      }));
      scheduleSave(get);
      useCanvasUiStore.getState().setVideoTrimEditingNodeId(null);
      const base = imported.rel_path.split(/[/\\]/).pop() ?? imported.rel_path;
      get().setStatusText(`已导出裁剪：${base}（已替换节点成片）`);
    } catch (e) {
      get().setStatusText(formatUserError(e));
    }
  },

  extractVideoAudioLeftOfNode: async (videoNodeId, mode) => {
    if (!isTauri()) {
      get().setStatusText(DESKTOP_SHELL_HINT);
      return;
    }
    const { projectPath, nodes } = get();
    if (!projectPath?.trim()) {
      get().setStatusText("请先新建或打开工程目录");
      return;
    }
    const vNode = nodes.find((n) => n.id === videoNodeId && n.type === "videoNode");
    if (!vNode) return;
    const relPath = vNode.data.path?.trim();
    if (!relPath) {
      get().setStatusText("请先上传或生成视频");
      return;
    }

    get().setStatusText(mode === "vocal" ? "正在提取音轨…" : "正在处理…");

    try {
      const imported = await extractVideoAudioToAssets(projectPath, relPath, mode);
      const state = get();
      const freshVNode = state.nodes.find((n) => n.id === videoNodeId);
      if (!freshVNode) return;

      const y = computeNextLeftInputY(state.nodes, state.edges, videoNodeId, freshVNode.position.y);
      const x = leftInputColumnX(freshVNode.position.x);
      const newId = crypto.randomUUID();
      const baseLabel = freshVNode.data.label?.trim() || "视频";
      const audioLabel = `${baseLabel} 音频`;

      const node: Node<FlowNodeData> = {
        id: newId,
        type: "audioNode",
        position: { x, y },
        data: {
          ...newNodeDataByType.audioNode(),
          label: audioLabel,
          path: imported.relPath,
          assetId: imported.assetId,
        },
      };

      recordBeforeDiscreteMutation(get);
      set((s) => ({
        nodes: [...s.nodes, node],
        edges: [...s.edges, makeFlowEdge(newId, videoNodeId, "audioNode")],
      }));
      scheduleSave(get);
      get().setSelectedNodeIds([newId]);
      get().setStatusText(
        mode === "vocal"
          ? "已提取混合音轨到左侧音频节点（AI 人声/伴奏分离敬请期待）"
          : "已提取音轨",
      );
    } catch (e) {
      get().setStatusText(formatUserError(e));
    }
  },

  loadGraph: (nodes, edges, viewport) => {
    clearHistoryStacks();
    const { edges: cleanedEdges } = sanitizeCanvasEdges(nodes, edges);
    const syncedNodes = applyTextWorkflowSyncToNodes(nodes, cleanedEdges);
    set({
      nodes: syncedNodes,
      edges: cleanedEdges,
      viewport,
      selectedNodeId: null,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      flowClipboardCount: getFlowClipboardCount(),
    });
    // 重建 Hermes shotNodeRegistry，确保切换 tab 时状态联动仍有效
    rebuildShotNodeRegistry(syncedNodes);
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
    const sorted = [...movable].sort(
      (a, b) => a.position.y - b.position.y || a.position.x - b.position.x,
    );
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
        "m4v",
        "mpeg",
        "mpg",
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
          : ["mp4", "mov", "webm", "avi", "mkv", "m4v", "mpeg", "mpg"].includes(ext)
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
      const target = get().nodes.find((n) => n.id === nodeId);
      const patch: Partial<FlowNodeData> = {
        path: first.relPath,
        assetId: first.assetId,
      };
      if (target?.type === "videoNode") {
        const curVideo = target.data.video;
        patch.video = {
          ...defaultVideoNodePersisted(),
          ...curVideo,
          source: "upload",
          draft: curVideo?.draft ?? defaultVideoGenerationDraft(),
        };
      }
      get().updateNodeData(nodeId, patch);
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
      const y = computeNextLeftInputY(
        state.nodes,
        state.edges,
        targetImageNodeId,
        target.position.y,
      );
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
