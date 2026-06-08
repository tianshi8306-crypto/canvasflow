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
import { clearDirtyTracking, markAllDirty, markEdgeDirty, markNodeDirty } from "@/lib/incrementalSerialize";
import {
  serializeCanvasToBytesAsync,
  serializeCanvasToBytesIncremental,
  yieldToMain,
} from "@/lib/serializeCanvasAsync";
import { FIRST_LAST_FRAME_EXAMPLE_PROMPT } from "@/lib/firstLastFrameSetup";
import { FIRST_FRAME_DEFAULT_PROMPT } from "@/lib/videoInputConstraints";
import { computeNextLeftInputY, leftInputColumnX } from "@/lib/videoInputNodeLayout";
import {
  CANVAS_NODE_LAYOUT_GAP,
  computeBatchImportDropPositions,
} from "@/lib/nodeLayout";
import { applyGridSnapToPositionChanges } from "@/lib/nodeGridSnap";
import { snapNodePositionChanges } from "@/lib/nodeSnapAlignment";
import {
  alignOpLabel,
  computeAlignedPositions,
  computeDistributedPositions,
  distributeOpLabel,
} from "@/lib/nodeAlignCommands";
import { selectionIdsEqual } from "@/lib/canvasGroup";
import {
  clampGroupDimensionChanges,
  computeGroupSizeFromMembers,
  normalizeGroupNodesForCanvas,
  planNestedGroup,
  ungroupNodes,
} from "@/lib/canvasGroup";
import { applyCanvasTidyLayout, computeLayoutPositions } from "@/lib/canvasTidyLayout";
import {
  applyGroupMembershipAfterDrag,
  syncGroupStylesFromDimensions,
} from "@/lib/canvasGroupMembership";
import { groupKindLabel } from "@/lib/canvasGroupStoryboard";
import { collectGroupSubtreeIds } from "@/lib/canvasGroupDuplicate";
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
import { patchVideoNodesWithUpstreamVideoPrompt } from "@/lib/videoGeneration/videoVideoPromptSync";
import { CANVAS_EDGE_STYLE_DEFAULT } from "@/lib/canvasColors";
import { makeFlowEdge } from "@/lib/flowEdge";
import { edgeToggleStatusText, isEdgeDisabled } from "@/lib/edgeState";
import {
  buildPasteEdgesFromClipboard,
  buildPasteNodesFromClipboard,
} from "@/lib/buildPasteNodesFromClipboard";
import { buildForkDuplicatePaste } from "@/lib/createNodeForkDuplicate";
import { cloneFlowNodeData } from "@/lib/flowNodeDataClone";
import { defaultViewport } from "@/lib/serialization";
import { runCoalescedProjectSave } from "@/store/projectSaveRunner";
import type { FlowNodeData } from "@/lib/types";
import { importMediaFiles as importMediaFilesApi } from "@/shared/api/assets";
import { defaultVideoGenerationDraft, defaultVideoNodePersisted } from "@/lib/videoNodeTypes";
import {
  buildComposeClipsFromScript,
  clipsToRenderPayload,
  composeClipToTimeline,
  defaultExportRelPath,
  exportEncodeToInvokePayload,
  normalizeExportEncode,
  parseExportFormatArg,
  resolveExportFormat,
  findConcatNodeForScriptVideos,
  formatComposeMissingHint,
  applyIncomingComposeClipSync,
  patchComposeNodeAfterExport,
  timelineClipsToNodePatch,
} from "@/lib/compose";
import { resolveNodeMediaRelPath } from "@/lib/nodeMediaRef";
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
import { exportGroupMediaImpl, runGroupSubgraphImpl } from "./projectGroupRuns";
import {
  convertGroupToStoryboardImpl,
  duplicateGroupImpl,
  insertGroupTemplateImpl,
  runGroupHermesImagesImpl,
  saveGroupToToolboxImpl,
  setGroupColorTokenImpl,
} from "./projectGroupProduction";
import {
  deleteWorkflowImpl,
  insertWorkflowImpl,
  saveWorkflowFromSelectionImpl,
} from "./projectWorkflowProduction";
import {
  rerunFailedSubgraphImpl,
  runNodeSubgraphImpl,
  runWorkflowImpl,
} from "./projectWorkflowRuns";
import { rebuildShotNodeRegistry } from "@/lib/hermes";
import { bindActiveTabToProject, syncActiveTabUnsaved } from "@/lib/canvasTabSync";
import {
  applyProjectSnapshot,
  loadProjectFolder,
  type ProjectGraphSnapshot,
} from "@/lib/projectWorkspaceLoad";
import { useProjectBibleStore } from "@/store/projectBibleStore";
import { useHermesOrbSuggestStore } from "@/store/hermesOrbSuggestStore";
import { rememberProjectOpened, removeRecentProject } from "@/lib/recentProjects";
import { pickProjectFolder } from "@/lib/pickProjectFolder";
import {
  filterReactFlowEdgeEchoChanges,
  isReactFlowGraphSyncLocked,
  runIgnoringReactFlowSelectionEcho,
  runWithReactFlowGraphSyncLock,
  stripEphemeralNodeFields,
} from "@/lib/reactFlowControlled";

/** 上次成功写入磁盘时的 graphRevision，用于跳过无实质变更的保存 */
let lastSavedGraphRevision = -1;

export function resetProjectSaveRevisionBaseline(revision = 0) {
  lastSavedGraphRevision = revision;
}

/** 视频/合成节点连入剪辑节点后，把上游成片写入时间线 */
async function syncComposeClipFromNewEdge(
  get: () => ProjectState,
  composeNodeId: string,
  sourceNodeId: string,
) {
  const { projectPath, nodes, edges, updateNodeData, setStatusText } = get();
  if (!projectPath?.trim()) {
    setStatusText("请先打开工程后再导入剪辑片段");
    return;
  }
  try {
    await applyIncomingComposeClipSync(
      composeNodeId,
      sourceNodeId,
      projectPath,
      nodes,
      edges,
      { updateNodeData, setStatusText },
    );
  } catch (e) {
    setStatusText(`导入剪辑片段失败：${formatUserError(e)}`);
  }
}

// ── 拖拽 RAF 节流：将 position 变更从每帧 60fps 降低到每帧最多 1 次 store 写入 ──
let dragRafId: number | null = null;
type DragFlushPayload = {
  changes: NodeChange<Node<FlowNodeData>>[];
  storeGet: () => ProjectState;
  /** 只有在 store 闭包内部才能获取，由 onNodesChange 在触发时注入 */
  flush: () => void;
};
let pendingDragPayload: DragFlushPayload | null = null;

export const useProjectStore = create<ProjectState>((set, get) => {
  // 拖拽 RAF flush：由 onNodesChange 在拖拽过程中注入 lambda
  function flushDragChanges() {
    dragRafId = null;
    const payload = pendingDragPayload;
    pendingDragPayload = null;
    payload?.flush();
  }

  function scheduleRafDragFlush(payload: DragFlushPayload) {
    pendingDragPayload = payload;
    if (dragRafId === null) {
      dragRafId = requestAnimationFrame(flushDragChanges);
    }
  }
  const loadSnapshotIntoStore = (snapshot: ProjectGraphSnapshot) => {
    runWithReactFlowGraphSyncLock(() => {
      runIgnoringReactFlowSelectionEcho(() => {
        const patch = applyProjectSnapshot(snapshot);
        set(patch);
        resetProjectSaveRevisionBaseline(patch.graphRevision ?? 0);
        rebuildShotNodeRegistry(patch.nodes);
        markAllDirty(patch.nodes, patch.edges || []);
        if (patch.nodes.length === 0) {
          useCanvasUiStore.getState().resetEmptyGuide();
        } else {
          useCanvasUiStore.getState().dismissEmptyGuide();
        }
        bindActiveTabToProject();
      });
    });
  };

  const markGraphDirtyOnly = () => {
    set({ projectDirty: true });
    if (useCanvasUiStore.getState().tabs.length === 0) {
      bindActiveTabToProject();
    } else {
      syncActiveTabUnsaved(true);
    }
  };

  const afterGraphEdit = () => {
    set((s) => ({
      projectDirty: true,
      graphRevision: s.graphRevision + 1,
    }));
    if (useCanvasUiStore.getState().tabs.length === 0) {
      bindActiveTabToProject();
    } else {
      syncActiveTabUnsaved(true);
    }
    if (get().projectPath) scheduleSave(get);
  };

  return {
  projectPath: null,
  nodes: [],
  edges: [],
  viewport: defaultViewport,
  selectedNodeId: null,
  selectedNodeIds: [],
  selectedEdgeIds: [],
  lastSavedAt: null,
  projectDirty: false,
  graphRevision: 0,
  lastRunId: null,
  nodeRunStateById: {},
  isGraphRunning: false,
  statusText: "未打开工程",
  flowClipboardCount: 0,
  scriptFullscreenNodeId: null,
  activeStyleId: null,
  /** 图片节点序号计数器，每个工程独立（用于 "图片 1", "图片 2" ...） */
  imageNodeCounter: 0,
  videoNodeCounter: 0,
  textNodeCounter: 0,
  audioNodeCounter: 0,
  scriptNodeCounter: 0,

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

  nextTextNodeLabel: () => {
    const n = get().textNodeCounter + 1;
    set({ textNodeCounter: n });
    return `文本 ${n}`;
  },

  nextAudioNodeLabel: () => {
    const n = get().audioNodeCounter + 1;
    set({ audioNodeCounter: n });
    return `音频 ${n}`;
  },

  nextScriptNodeLabel: () => {
    const n = get().scriptNodeCounter + 1;
    set({ scriptNodeCounter: n });
    return `分镜脚本 ${n}`;
  },

  setProjectPath: (p) => set({ projectPath: p }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setSelectedNodeIds: (ids) => {
    const { selectedNodeIds } = get();
    if (selectionIdsEqual(selectedNodeIds, ids)) return;
    runIgnoringReactFlowSelectionEcho(() => {
      set({ selectedNodeIds: ids, selectedNodeId: ids[0] ?? null });
    });
  },
  setSelectedEdgeIds: (ids) => {
    if (selectionIdsEqual(get().selectedEdgeIds, ids)) return;
    set({ selectedEdgeIds: ids });
  },
  setStatusText: (t) => set({ statusText: t }),
  setViewport: (v) => set({ viewport: v }),
  openScriptFullscreen: (nodeId) => set({ scriptFullscreenNodeId: nodeId }),
  closeScriptFullscreen: () => set({ scriptFullscreenNodeId: null }),
  setActiveStyleId: (id) => {
    set({ activeStyleId: id });
    markGraphDirtyOnly();
    if (get().projectPath) scheduleSave(get);
  },
  setLastRunId: (runId: string) => set({ lastRunId: runId }),

  onNodesChange: (changes) => {
    if (isReactFlowGraphSyncLocked()) return;
    const nodes = get().nodes;
    const ui = useCanvasUiStore.getState();
    const snapOn = ui.nodeSnapAlignmentEnabled;
    const typedChanges = changes as NodeChange<Node<FlowNodeData>>[];
    // 选区由 onSelectionChange + nodesView 派生；忽略 select 变更，防止与 RF 互相触发死循环
    // 非 group 节点的 dimensions 为 RF 自动测量，写回 store 会与 nodesView 形成 Maximum update depth
    const graphChanges = typedChanges.filter((c) => {
      if (c.type === "select") return false;
      // 受控 nodes 由 store 写入；忽略 RF 内部 replace/add/remove 回声
      if (c.type === "replace" || c.type === "add" || c.type === "remove") return false;
      if (c.type === "dimensions") {
        const node = nodes.find((n) => n.id === c.id);
        return node?.type === "group";
      }
      // 仅用户拖拽时写回 position；挂载/测量附带的 dragging:false 会触发 Maximum update depth
      if (c.type === "position") {
        const dragging = (c as { dragging?: boolean }).dragging;
        if (dragging === true) return true;
        if (dragging === false && ui.nodeDragSuppressUi) return true;
        return false;
      }
      return false;
    });
    if (graphChanges.length === 0) return;
    scheduleHistoryBurst(get);
    runWithReactFlowGraphSyncLock(() => {
    let nextChanges = clampGroupDimensionChanges(graphChanges, nodes);
    if (snapOn) {
      const snapped = snapNodePositionChanges(graphChanges, nodes, {
        showGuides: ui.snapGuidesEnabled,
      });
      nextChanges = snapped.changes;
      ui.setNodeSnapVisual(snapped.visual);
    } else {
      ui.setNodeSnapVisual(null);
    }
    const dragEnded = graphChanges.some(
      (c) => c.type === "position" && (c as { dragging?: boolean }).dragging === false,
    );
    const draggingNow = graphChanges.some(
      (c) => c.type === "position" && (c as { dragging?: boolean }).dragging === true,
    );

    // 拖拽中：用 RAF 节流 store 写入，从每帧 60 次降到最多 16 次
    if (draggingNow && !dragEnded) {
      scheduleRafDragFlush({
        changes: nextChanges,
        storeGet: get,
        flush: () => {
          set((s) => {
            let nextNodes = applyNodeChanges(nextChanges, s.nodes);
            nextNodes = syncGroupStylesFromDimensions(nextNodes);
            if (nextNodes === s.nodes) return s;
            return {
              nodes: nextNodes,
              projectDirty: true,
            };
          });
          for (const c of nextChanges) if (c.type === "position") markNodeDirty(c.id);
          markGraphDirtyOnly();
        },
      });
      return;
    }

    // 拖拽结束：先 flush 最后一个等待的 RAF，再应用收尾逻辑
    if (dragEnded && dragRafId !== null) {
      flushDragChanges();
    }

    if (dragEnded) {
      ui.setNodeSnapVisual(null);
      if (ui.snapGridEnabled) {
        const step = ui.alignDistributeGap ?? CANVAS_NODE_LAYOUT_GAP;
        nextChanges = applyGridSnapToPositionChanges(nextChanges, step);
      }
    }
    let graphChanged = false;
    set((s) => {
      let nextNodes = applyNodeChanges(nextChanges, s.nodes);
      nextNodes = syncGroupStylesFromDimensions(nextNodes);
      if (dragEnded) {
        nextNodes = applyGroupMembershipAfterDrag(nextNodes, graphChanges);
      }
      if (nextNodes === s.nodes) return s;
      graphChanged = true;
      return {
        nodes: nextNodes,
        projectDirty: true,
      };
    });
    if (!graphChanged) return;
    for (const c of nextChanges) if (c.type === "position" || c.type === "dimensions") markNodeDirty(c.id);
    afterGraphEdit();
    });
  },
  onEdgesChange: (changes) => {
    if (isReactFlowGraphSyncLocked()) return;
    const graphChanges = filterReactFlowEdgeEchoChanges(changes);
    if (graphChanges.length === 0) return;
    scheduleHistoryBurst(get);
    runWithReactFlowGraphSyncLock(() => {
    set((s) => {
      const nextEdges = applyEdgeChanges(graphChanges, s.edges);
      const nextNodes = applyTextWorkflowSyncToNodes(s.nodes, nextEdges);
      if (nextEdges === s.edges && nextNodes === s.nodes) return s;
      return {
        edges: nextEdges,
        nodes: nextNodes,
        projectDirty: true,
      };
    });
    for (const c of graphChanges) if ("id" in c) markEdgeDirty(c.id);
    afterGraphEdit();
    });
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
          style: { ...CANVAS_EDGE_STYLE_DEFAULT },
          ...(payloadType ? { data: { payloadType } } : {}),
        },
        s.edges,
      );
      let nodes = applyTextWorkflowSyncToNodes(s.nodes, edges);
      const tn = s.nodes.find((n) => n.id === normalized.target);
      if (tn?.type === "videoNode") {
        nodes = patchVideoNodesWithUpstreamVideoPrompt(nodes, edges, normalized.target, {
          onlyIfPromptEmpty: true,
        });
      }
      return { edges, nodes };
    });
    afterGraphEdit();
    for (const e of get().edges) markEdgeDirty(e.id);

    const targetNode = get().nodes.find((n) => n.id === normalized.target);
    if (
      targetNode?.type === "ffmpegConcat" &&
      (sn.type === "videoNode" || sn.type === "ffmpegConcat")
    ) {
      const composeId = normalized.target;
      const sourceId = normalized.source;
      setTimeout(() => {
        void syncComposeClipFromNewEdge(get, composeId, sourceId);
      }, 0);
    }
  },

  deleteEdge: (edgeId) => {
    recordBeforeDiscreteMutation(get);
    set((s) => {
      const edges = s.edges.filter((e) => e.id !== edgeId);
      const nodes = applyTextWorkflowSyncToNodes(s.nodes, edges);
      return {
        edges,
        nodes,
        selectedEdgeIds: s.selectedEdgeIds.filter((id) => id !== edgeId),
        statusText: "已删除连线",
      };
    });
    afterGraphEdit();
  },

  updateNodeData: (id, patch, opts) => {
    if (!opts?.silent) recordBeforeDiscreteMutation(get);
    markNodeDirty(id);
    set((s) => ({
      nodes: s.nodes.map((n) => {
        if (n.id !== id) return n;
        const data = { ...n.data, ...patch };
        for (const [key, val] of Object.entries(patch)) {
          if (val === undefined) delete (data as Record<string, unknown>)[key];
        }
        return { ...n, data };
      }),
      ...(opts?.silent ? {} : { projectDirty: true }),
    }));
    if (opts?.silent) {
      if (get().projectPath) scheduleSave(get);
    } else {
      afterGraphEdit();
    }
  },

  newProject: async () => {
    if (!isTauri()) {
      set({ statusText: DESKTOP_SHELL_HINT });
      return;
    }
    try {
      const folder = await pickProjectFolder(get().projectPath);
      if (!folder) return;
      const snapshot = await loadProjectFolder(folder, "new");
      loadSnapshotIntoStore(snapshot);
      await useProjectBibleStore.getState().loadForProject(folder);
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
      const folder = await pickProjectFolder(get().projectPath);
      if (!folder) return;
      const snapshot = await loadProjectFolder(folder, "open");
      loadSnapshotIntoStore(snapshot);
      await useProjectBibleStore.getState().loadForProject(folder);
      await focusShellAfterNativeDialog();
    } catch (e) {
      set({ statusText: `打开工程失败：${formatUserError(e)}` });
    }
  },

  openProjectAtPath: async (folder: string) => {
    if (!isTauri()) {
      set({ statusText: DESKTOP_SHELL_HINT });
      return;
    }
    const path = folder.trim();
    if (!path) return;
    try {
      const snapshot = await loadProjectFolder(path, "open");
      loadSnapshotIntoStore(snapshot);
      await useProjectBibleStore.getState().loadForProject(path);
      await focusShellAfterNativeDialog();
    } catch (e) {
      removeRecentProject(path);
      set({ statusText: `打开工程失败：${formatUserError(e)}` });
    }
  },

  closeProject: async () => {
    const { projectPath, projectDirty } = get();
    if (!projectPath) return;

    const doClose = () => {
      rebuildShotNodeRegistry([]);
      clearHistoryStacks();
      useProjectBibleStore.getState().reset();
      useHermesOrbSuggestStore.getState().reset();
      set({
        projectPath: null,
        nodes: [],
        edges: [],
        viewport: defaultViewport,
        selectedNodeId: null,
        selectedNodeIds: [],
        selectedEdgeIds: [],
        lastRunId: null,
        nodeRunStateById: {},
        lastSavedAt: null,
        projectDirty: false,
        graphRevision: 0,
        statusText: "未打开工程",
        flowClipboardCount: getFlowClipboardCount(),
        imageNodeCounter: 0,
        videoNodeCounter: 0,
        textNodeCounter: 0,
        audioNodeCounter: 0,
        scriptNodeCounter: 0,
        activeStyleId: null,
      });
      useCanvasUiStore.getState().resetEmptyGuide();
      bindActiveTabToProject();
      resetProjectSaveRevisionBaseline(0);
    };

    if (projectDirty) {
      useCanvasUiStore.getState().openConfirmDialog({
        title: "关闭工程？",
        message: "当前工程有尚未写入磁盘的更改，关闭后将丢弃（若已自动保存可忽略）。确定关闭？",
        onConfirm: doClose,
        onCancel: () => {},
      });
      return;
    }
    doClose();
  },

  saveProject: async () => {
    await runCoalescedProjectSave(async () => {
      if (!isTauri()) {
        set({ statusText: DESKTOP_SHELL_HINT });
        return;
      }
      const {
        projectPath,
        nodes,
        edges,
        viewport,
        imageNodeCounter,
        videoNodeCounter,
        textNodeCounter,
        audioNodeCounter,
        scriptNodeCounter,
        activeStyleId,
      } = get();
      if (!projectPath) return;
      const { projectDirty, graphRevision } = get();
      if (!projectDirty) return;
      if (graphRevision === lastSavedGraphRevision) {
        set({ projectDirty: false });
        syncActiveTabUnsaved(false);
        return;
      }
      try {
        await yieldToMain();
        const content = serializeCanvasToBytesIncremental(nodes, edges, viewport, {
          imageNodeCounter,
          videoNodeCounter,
          textNodeCounter,
          audioNodeCounter,
          scriptNodeCounter,
          activeStyleId,
        });
        await yieldToMain();
        await invoke("write_canvasflow_json_bytes", { projectPath, content });
        await useProjectBibleStore.getState().flushSave();
        lastSavedGraphRevision = get().graphRevision;
        clearDirtyTracking();
        set({ lastSavedAt: Date.now(), projectDirty: false });
        syncActiveTabUnsaved(false);
      } catch (e) {
        set({ statusText: `保存失败：${formatUserError(e)}` });
      }
    });
  },

  saveProjectAs: async () => {
    if (!isTauri()) {
      set({ statusText: DESKTOP_SHELL_HINT });
      return;
    }
    const {
      nodes,
      edges,
      viewport,
      imageNodeCounter,
      videoNodeCounter,
      textNodeCounter,
      audioNodeCounter,
      scriptNodeCounter,
      activeStyleId,
    } = get();
    try {
      const folder = await pickProjectFolder(get().projectPath);
      if (!folder) return;
      await invoke("ensure_project_structure", { projectPath: folder });
      await yieldToMain();
      const content = await serializeCanvasToBytesAsync(nodes, edges, viewport, {
        imageNodeCounter,
        videoNodeCounter,
        textNodeCounter,
        audioNodeCounter,
        scriptNodeCounter,
        activeStyleId,
      });
      await invoke("write_canvasflow_json_bytes", { projectPath: folder, content });
      await useProjectBibleStore.getState().loadForProject(folder);
      await useProjectBibleStore.getState().flushSave();
      clearHistoryStacks();
      rememberProjectOpened(folder);
      resetProjectSaveRevisionBaseline(0);
      set({
        projectPath: folder,
        lastSavedAt: Date.now(),
        projectDirty: false,
        graphRevision: 0,
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

  runGroupSubgraph: runGroupSubgraphImpl(get, set),

  exportGroupMedia: exportGroupMediaImpl(get, set),

  convertGroupToStoryboard: convertGroupToStoryboardImpl(get, set),

  runGroupHermesImages: runGroupHermesImagesImpl(get, set),

  duplicateGroup: duplicateGroupImpl(get, set),

  setGroupColorToken: setGroupColorTokenImpl(get, set),

  saveGroupToToolbox: saveGroupToToolboxImpl(get, set),

  insertGroupTemplate: insertGroupTemplateImpl(get, set),

  saveWorkflowFromSelection: saveWorkflowFromSelectionImpl(get, set),

  insertWorkflow: insertWorkflowImpl(get, set),

  deleteWorkflow: deleteWorkflowImpl(get, set),

  rerunFailedSubgraph: rerunFailedSubgraphImpl(get, set),

  addNode: (node) => {
    recordBeforeDiscreteMutation(get);
    const clean = stripEphemeralNodeFields([node])[0] ?? node;
    runWithReactFlowGraphSyncLock(() => {
      set((s) => ({ nodes: [...s.nodes, clean] }));
      markNodeDirty(clean.id);
      afterGraphEdit();
    });
  },

  addNodesWithEdges: (newNodes, newEdges) => {
    recordBeforeDiscreteMutation(get);
    const mergedNodes = [...get().nodes, ...stripEphemeralNodeFields(newNodes)];
    const { edges: cleanedNew } = sanitizeCanvasEdges(mergedNodes, newEdges);
    runWithReactFlowGraphSyncLock(() => {
      set((s) => ({
        nodes: [...s.nodes, ...stripEphemeralNodeFields(newNodes)],
        edges: [...s.edges, ...cleanedNew],
      }));
      for (const n of stripEphemeralNodeFields(newNodes)) markNodeDirty(n.id);
      for (const e of cleanedNew) markEdgeDirty(e.id);
      afterGraphEdit();
    });
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
    const nodesWithPartner = [...state.nodes, newNode];
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
      nodesWithPartner,
      state.edges,
    );
    if (!verdict.ok) {
      set({ statusText: `无法创建连线：${verdict.reason}` });
      return;
    }
    recordBeforeDiscreteMutation(get);
    set((s) => {
      const edges = [...s.edges, edge];
      const nodes = applyTextWorkflowSyncToNodes([...s.nodes, newNode], edges);
      return { nodes, edges };
    });
    afterGraphEdit();
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
      afterGraphEdit();
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
    afterGraphEdit();
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
      afterGraphEdit();
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
    afterGraphEdit();
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
    afterGraphEdit();
    get().setSelectedNodeIds([newId]);
    get().setStatusText("已在左侧添加输入节点并联线；成片输出请从本节点右侧连接");
  },

  openVideoClipConcat: async (videoNodeId) => {
    const state = get();
    const projectPath = state.projectPath;
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
      if (projectPath) {
        await syncComposeClipFromNewEdge(get, concatId, videoNodeId);
      }
      get().setSelectedNodeIds([concatId]);
      useCanvasUiStore.getState().setComposeEditorNodeId(concatId);
      return;
    }

    const videoPath =
      (await resolveNodeMediaRelPath(projectPath, vNode.data))?.trim() ??
      vNode.data.path?.trim() ??
      "";
    if (!videoPath) {
      get().setStatusText("无法解析视频路径，请确认视频已出片并打开工程");
      return;
    }

    const gap = 80;
    const videoW =
      typeof vNode.measured?.width === "number" && vNode.measured.width > 0
        ? vNode.measured.width
        : 500;
    const concatId = crypto.randomUUID();
    const baseLabel = vNode.data.label?.trim() || "视频";

    const concatNode: Node<FlowNodeData> = {
      id: concatId,
      type: "ffmpegConcat",
      position: { x: vNode.position.x + videoW + gap, y: vNode.position.y },
      data: {
        ...newNodeDataByType.ffmpegConcat(),
        label: `${baseLabel} · 剪辑`,
        timelineClips: [
          {
            id: crypto.randomUUID(),
            relPath: videoPath,
            inSec: 0,
            outSec: null,
            sourceNodeId: videoNodeId,
          },
        ],
        inputs: [videoPath],
        output: "assets/exports/final.mp4",
      },
    };

    recordBeforeDiscreteMutation(get);
    set((s) => ({
      nodes: [...s.nodes, concatNode],
      edges: [...s.edges, makeFlowEdge(videoNodeId, concatId, "videoNode")],
    }));
    afterGraphEdit();
    get().setSelectedNodeIds([concatId]);
    useCanvasUiStore.getState().setComposeEditorNodeId(concatId);
    get().setStatusText("已打开视频剪辑工作台");
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
    const exportFmt = parseExportFormatArg(opts?.exportFormat) ?? "mp4";
    const outputRel = defaultExportRelPath(exportFmt);

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
          ...timelineClipsToNodePatch(built.clips.map(composeClipToTimeline)),
          output: outputRel,
          exportFormat: exportFmt,
        },
      };

      recordBeforeDiscreteMutation(get);
      set((s) => ({
        nodes: [...s.nodes, concatNode],
        edges: ensureEdgesToConcat(concatId as string, s.edges),
      }));
    } else {
      recordBeforeDiscreteMutation(get);
      const cur = get();
      const nextEdges = ensureEdgesToConcat(concatId, cur.edges);
      if (nextEdges.length !== cur.edges.length) {
        set({ edges: nextEdges });
      }
      const timelineClips = built.clips.map(composeClipToTimeline);
      get().updateNodeData(concatId, {
        ...timelineClipsToNodePatch(timelineClips),
        output: outputRel,
        exportFormat: exportFmt,
      });
    }

    afterGraphEdit();
    get().setSelectedNodeIds([concatId]);
    useCanvasUiStore.getState().setComposeEditorNodeId(concatId);

    const concatClips = built.clips.map(composeClipToTimeline);
    let outputRelPath: string | undefined;
    if (autoRender && concatClips.length > 0) {
      try {
        const concatData = get().nodes.find((n) => n.id === concatId)?.data;
        const encodeOptions = exportEncodeToInvokePayload(
          normalizeExportEncode(concatData ?? {}),
        );
        const renderFormat = resolveExportFormat(concatData ?? {}, outputRel);
        outputRelPath = await invoke<string>("render_timeline", {
          projectPath,
          clips: clipsToRenderPayload(concatClips, {}),
          outputRelPath: outputRel,
          encodeOptions: encodeOptions ?? null,
          exportFormat: renderFormat,
        });
        const exportPatch = await patchComposeNodeAfterExport(projectPath, outputRelPath);
        get().updateNodeData(concatId, exportPatch);
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
    afterGraphEdit();
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
    afterGraphEdit();
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
    afterGraphEdit();
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
    afterGraphEdit();
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
                  path: imported.relPath,
                  assetId: imported.assetId,
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
      afterGraphEdit();
      useCanvasUiStore.getState().setVideoSubtitleRegionEditingNodeId(null);
      const base = imported.relPath.split(/[/\\]/).pop() ?? imported.relPath;
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
                  path: imported.relPath,
                  assetId: imported.assetId,
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
      afterGraphEdit();
      useCanvasUiStore.getState().setVideoTrimEditingNodeId(null);
      const base = imported.relPath.split(/[/\\]/).pop() ?? imported.relPath;
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
      afterGraphEdit();
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
    const syncedNodes = normalizeGroupNodesForCanvas(
      applyTextWorkflowSyncToNodes(nodes, cleanedEdges),
    );
    if (syncedNodes.length === 0) {
      useCanvasUiStore.getState().resetEmptyGuide();
    } else {
      useCanvasUiStore.getState().dismissEmptyGuide();
    }
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

  restoreCanvasTab: ({ nodes, edges, viewport, projectPath, projectDirty, statusText }) => {
    clearHistoryStacks();
    const { edges: cleanedEdges } = sanitizeCanvasEdges(nodes, edges);
    const syncedNodes = stripEphemeralNodeFields(
      normalizeGroupNodesForCanvas(applyTextWorkflowSyncToNodes(nodes, cleanedEdges)),
    );
    runWithReactFlowGraphSyncLock(() => {
      runIgnoringReactFlowSelectionEcho(() => {
        if (syncedNodes.length === 0) {
          useCanvasUiStore.getState().resetEmptyGuide();
        } else {
          useCanvasUiStore.getState().dismissEmptyGuide();
        }
        rebuildShotNodeRegistry(syncedNodes);
        set({
          projectPath,
          nodes: syncedNodes,
          edges: cleanedEdges,
          viewport,
          projectDirty,
          selectedNodeId: null,
          selectedNodeIds: [],
          selectedEdgeIds: [],
          lastRunId: null,
          nodeRunStateById: {},
          lastSavedAt: projectDirty ? null : Date.now(),
          statusText,
          flowClipboardCount: getFlowClipboardCount(),
        });
      });
    });
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
    const verdict = planNestedGroup(nodes, selectedNodeIds);
    if (!verdict.ok) {
      get().setStatusText(verdict.message);
      return;
    }
    const { plan } = verdict;
    recordBeforeDiscreteMutation(get);
    const groupId = crypto.randomUUID();
    const rootIds = new Set(plan.roots.map((r) => r.id));

    const parentGroupZ =
      plan.parentId != null
        ? (nodes.find((n) => n.id === plan.parentId)?.zIndex ?? 0)
        : -1;
    const groupZ = parentGroupZ + 1;
    const memberZ = groupZ + 1;
    const memberCount = plan.roots.length;

    const groupNode: Node<FlowNodeData> = {
      id: groupId,
      type: "group",
      position: plan.groupPosition,
      ...(plan.parentId
        ? { parentId: plan.parentId, extent: "parent" as const }
        : {}),
      style: {
        width: plan.width,
        height: plan.height,
        borderRadius: "12px",
        background: "transparent",
      },
      data: {
        label: groupKindLabel(undefined, memberCount),
      },
      draggable: true,
      selectable: true,
      dragHandle: ".groupNode__dragHandle",
      zIndex: groupZ,
    };

    const nextNodes = normalizeGroupNodesForCanvas([
      ...nodes.map((n) => {
        const rel = plan.memberPositions.get(n.id);
        if (!rel) return n;
        return {
          ...n,
          parentId: groupId,
          position: rel,
          zIndex: memberZ,
          draggable: n.draggable !== false,
        };
      }),
      groupNode,
    ]);
    const nested = plan.parentId ? "（嵌套）" : "";
    set({
      nodes: nextNodes.map((n) => ({ ...n, selected: n.id === groupId })),
      selectedNodeIds: [groupId],
      selectedNodeId: groupId,
      selectedEdgeIds: [],
      statusText: `已将 ${rootIds.size} 个节点打组${nested}`,
    });
    afterGraphEdit();
  },

  ungroupSelectedNodes: () => {
    const { selectedNodeIds, nodes } = get();
    const groupIds = selectedNodeIds.filter(
      (id) => nodes.find((n) => n.id === id)?.type === "group",
    );
    if (groupIds.length === 0) {
      get().setStatusText("请先选中要打散的组节点");
      return;
    }
    recordBeforeDiscreteMutation(get);
    let nextNodes = nodes;
    const childIds: string[] = [];
    for (const gid of groupIds) {
      for (const c of nextNodes.filter((n) => n.parentId === gid)) {
        childIds.push(c.id);
      }
      nextNodes = ungroupNodes(nextNodes, gid);
    }
    set({
      nodes: nextNodes,
      selectedNodeIds: childIds.length > 0 ? childIds : [],
      selectedNodeId: childIds[0] ?? null,
      statusText: `已解组 ${groupIds.length} 个`,
    });
    afterGraphEdit();
  },

  selectNodesByIds: (ids) => {
    const { selectedNodeIds, selectedEdgeIds } = get();
    if (selectionIdsEqual(selectedNodeIds, ids) && selectedEdgeIds.length === 0) return;
    runIgnoringReactFlowSelectionEcho(() => {
      set({
        selectedNodeIds: ids,
        selectedNodeId: ids[0] ?? null,
        selectedEdgeIds: [],
      });
    });
  },

  arrangeSelectedNodes: (mode, opts) => {
    const { selectedNodeIds, nodes } = get();
    const movable = selectedNodeIds
      .map((id) => nodes.find((n) => n.id === id))
      .filter((n): n is Node<FlowNodeData> => Boolean(n && !n.parentId));
    if (movable.length < 2) {
      get().setStatusText("请框选至少两个未嵌套的节点再排列");
      return;
    }
    recordBeforeDiscreteMutation(get);
    const gap = useCanvasUiStore.getState().alignDistributeGap ?? CANVAS_NODE_LAYOUT_GAP;
    const baseX = Math.min(...movable.map((n) => n.position.x));
    const baseY = Math.min(...movable.map((n) => n.position.y));
    const nextPos = computeLayoutPositions(movable, mode, gap, { x: baseX, y: baseY }, opts);
    set((s) => ({
      nodes: s.nodes.map((n) => {
        const p = nextPos.get(n.id);
        return p ? { ...n, position: p } : n;
      }),
      projectDirty: true,
    }));
    afterGraphEdit();
  },

  tidyCanvasLayout: () => {
    const { nodes } = get();
    const topLevel = nodes.filter((n) => !n.parentId);
    if (topLevel.length === 0) {
      get().setStatusText("没有可整理的顶层节点");
      return 0;
    }
    recordBeforeDiscreteMutation(get);
    const gap = useCanvasUiStore.getState().alignDistributeGap ?? CANVAS_NODE_LAYOUT_GAP;
    const { nodes: nextNodes, movedCount } = applyCanvasTidyLayout(nodes, gap, "grid");
    set({
      nodes: nextNodes,
      projectDirty: true,
    });
    get().setStatusText(
      movedCount > 1
        ? `已整理 ${movedCount} 个节点（宫格排列），可点还原或 Ctrl+Z 撤销`
        : "已整理画布并适配视口",
    );
    afterGraphEdit();
    return movedCount;
  },

  nudgeSelectedNodes: (dx, dy) => {
    const { selectedNodeIds } = get();
    if (!selectedNodeIds.length || (dx === 0 && dy === 0)) return;
    recordBeforeDiscreteMutation(get);
    const idSet = new Set(selectedNodeIds);
    set((s) => ({
      nodes: s.nodes.map((n) =>
        idSet.has(n.id)
          ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
          : n,
      ),
      projectDirty: true,
    }));
    afterGraphEdit();
  },

  alignSelectedNodes: (op) => {
    const { selectedNodeIds, nodes } = get();
    const movable = selectedNodeIds
      .map((id) => nodes.find((n) => n.id === id))
      .filter((n): n is Node<FlowNodeData> => Boolean(n && !n.parentId));
    if (movable.length < 2) {
      get().setStatusText("请框选至少两个未嵌套的节点再对齐");
      return;
    }
    recordBeforeDiscreteMutation(get);
    const nextPos = computeAlignedPositions(movable, op);
    set((s) => ({
      nodes: s.nodes.map((n) => {
        const p = nextPos.get(n.id);
        return p ? { ...n, position: p } : n;
      }),
      projectDirty: true,
    }));
    get().setStatusText(`已${alignOpLabel(op)}`);
    afterGraphEdit();
  },

  distributeSelectedNodes: (op) => {
    const { selectedNodeIds, nodes } = get();
    const movable = selectedNodeIds
      .map((id) => nodes.find((n) => n.id === id))
      .filter((n): n is Node<FlowNodeData> => Boolean(n && !n.parentId));
    if (movable.length < 3) {
      get().setStatusText("请框选至少三个未嵌套的节点再等距分布");
      return;
    }
    recordBeforeDiscreteMutation(get);
    const nextPos = computeDistributedPositions(movable, op);
    if (nextPos.size === 0) {
      get().setStatusText("等距分布失败");
      return;
    }
    set((s) => ({
      nodes: s.nodes.map((n) => {
        const p = nextPos.get(n.id);
        return p ? { ...n, position: p } : n;
      }),
      projectDirty: true,
    }));
    get().setStatusText(`已${distributeOpLabel(op)}`);
    afterGraphEdit();
  },

  arrangeGroupMembers: (groupId, mode) => {
    const { nodes } = get();
    const group = nodes.find((n) => n.id === groupId && n.type === "group");
    if (!group) return;
    const members = nodes.filter((n) => n.parentId === groupId);
    if (members.length < 2) {
      get().setStatusText("组内至少需要两个节点才能排列");
      return;
    }
    recordBeforeDiscreteMutation(get);
    const gap = useCanvasUiStore.getState().alignDistributeGap ?? CANVAS_NODE_LAYOUT_GAP;
    const nextPos = computeLayoutPositions(members, mode, gap);
    const { width, height } = computeGroupSizeFromMembers(
      members.map((n) => {
        const p = nextPos.get(n.id);
        return p ? { ...n, position: p } : n;
      }),
    );
    set((s) => ({
      nodes: s.nodes.map((n) => {
        const p = nextPos.get(n.id);
        if (p) return { ...n, position: p };
        if (n.id === groupId) {
          return {
            ...n,
            style: { ...n.style, width, height },
          };
        }
        return n;
      }),
    }));
    afterGraphEdit();
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
      afterGraphEdit();
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
      afterGraphEdit();
      get().setSelectedNodeIds([newId]);
      set({ statusText: `已在左侧添加参考图节点：${rel}` });
    } catch (e) {
      set({ statusText: `上传失败：${formatUserError(e)}` });
    }
  },

  copySelection: () => {
    const { selectedNodeIds, nodes, edges } = get();
    if (selectedNodeIds.length === 0) return;
    const idsToCopy = new Set(selectedNodeIds);
    for (const id of selectedNodeIds) {
      const hit = nodes.find((x) => x.id === id);
      if (hit?.type === "group") {
        for (const sid of collectGroupSubtreeIds(nodes, id)) {
          idsToCopy.add(sid);
        }
      }
    }
    const cn = nodes
      .filter((n) => idsToCopy.has(n.id))
      .map((n) => ({ ...n, data: cloneFlowNodeData(n.data) }));
    const ce = edges
      .filter((e) => idsToCopy.has(e.source) && idsToCopy.has(e.target))
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
    const pastedGroup = nextNodes.find((n) => n.type === "group");
    const selectIds = pastedGroup ? [pastedGroup.id] : nextNodes.map((n) => n.id);
    set((s) => ({
      nodes: [...s.nodes.map((n) => ({ ...n, selected: selectIds.includes(n.id) })), ...nextNodes],
      edges: [...s.edges, ...nextEdges],
      selectedNodeIds: selectIds,
      selectedNodeId: selectIds[0] ?? null,
      statusText: pastedGroup
        ? `已粘贴分组副本（${nextNodes.length} 个节点）`
        : `已粘贴 ${nextNodes.length} 个`,
    }));
    afterGraphEdit();
  },

  createForkDuplicateOfSelection: () => {
    const { selectedNodeIds, nodes, edges } = get();
    if (selectedNodeIds.length === 0) return;
    const built = buildForkDuplicatePaste(nodes, edges, selectedNodeIds);
    if (!built) {
      set({
        statusText:
          selectedNodeIds.length === 1 && nodes.find((n) => n.id === selectedNodeIds[0])?.type === "group"
            ? "分组请使用工具栏「创建副本」整组复制"
            : "无法创建副本",
      });
      return;
    }
    const { nextNodes, nextEdges, newNodeIds } = built;
    recordBeforeDiscreteMutation(get);
    const upstreamCount = nextEdges.length;
    set((s) => ({
      nodes: [
        ...s.nodes.map((n) => ({ ...n, selected: false })),
        ...nextNodes,
      ],
      edges: [...s.edges, ...nextEdges],
      selectedNodeIds: newNodeIds,
      selectedNodeId: newNodeIds[0] ?? null,
      selectedEdgeIds: [],
      statusText:
        newNodeIds.length === 1
          ? `已创建副本（保留 ${upstreamCount} 条上游连线）`
          : `已创建 ${newNodeIds.length} 个副本（保留上游连线）`,
    }));
    afterGraphEdit();
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
    afterGraphEdit();
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
    afterGraphEdit();
  },

  undo: () => runUndo(get, set),

  redo: () => runRedo(get, set),
  };
});
