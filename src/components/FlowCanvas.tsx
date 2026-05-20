import {
  Background,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type NodeTypes,
  type OnConnectEnd,
  type OnConnectStart,
  type Viewport,
} from "@xyflow/react";
import { isTauri } from "@tauri-apps/api/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { useShallow } from "zustand/react/shallow";

import { nodeTypes } from "@/components/canvas/nodeTypes";
import { FileInputHandler } from "@/components/canvas/FileInputHandler";
import { MultiSelectionToolbar } from "@/components/canvas/MultiSelectionToolbar";
import { NodeSelectionToolbar } from "@/components/canvas/NodeSelectionToolbar";
import { MarkerToolbar } from "@/components/canvas/MarkerToolbar";
import { SelectionBoundsOverlay } from "@/components/canvas/SelectionBoundsOverlay";
import { CanvasContextMenus } from "@/components/canvas/CanvasContextMenus";
import { FLOW_MENU } from "@/components/canvas/menuConstants";
import type { FlowCanvasMenuState } from "@/components/canvas/flowCanvasMenuState";
import {
  assetNodeKindForMediaType,
  ASSET_LIST_DEFAULT_LIMIT,
  sortAssetsForGallery,
} from "@/lib/canvasAssets";
import { CustomConnectionLine } from "@/components/edges/CustomConnectionLine";
import { FlowConnectHint } from "@/components/canvas/FlowConnectHint";
import { PendingConnectionOverlay } from "@/components/canvas/PendingConnectionOverlay";
import { clearAnchorMenuSession } from "@/lib/anchorMenuSession";
import { useIsValidConnection } from "@/hooks/canvas/useIsValidConnection";
import { newNodeDataByType } from "@/lib/canvasNodeDefaults";
import { formatUserError } from "@/lib/errors";
import { pickMediaPathsForImport } from "@/lib/tauriMediaPaths";
import { useEdgeViewModel } from "@/hooks/useEdgeViewModel";
import { listAssets, syncAssetsIndex, type AssetSummary } from "@/shared/api/assets";
import { queryKeys } from "@/shared/queryKeys";
import { useProjectStore } from "@/store/projectStore";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { CanvasFlowChrome } from "@/components/canvas/CanvasFlowChrome";
import { NodeSnapGuideOverlay } from "@/components/canvas/NodeSnapGuideOverlay";
import { NodeMaximizedOverlay } from "@/components/canvas/NodeMaximizedOverlay";
import { ImageGenerationPanelExpandedModal } from "@/components/nodes/ImageGenerationPanelExpandedModal";
import { VideoGenerationPanelExpandedModal } from "@/components/nodes/VideoGenerationPanelExpandedModal";
import { TextComposerPanelExpandedModal } from "@/components/nodes/TextComposerPanelExpandedModal";
import { AudioTtsPanelExpandedModal } from "@/components/nodes/AudioTtsPanelExpandedModal";
import { isPassiveAudioAsset } from "@/lib/audioNodeContainerMode";
import { SubjectCreationPanel } from "@/components/SubjectCreationPanel";
import { LeftAddDock } from "@/components/LeftAddDock";

import { useViewportSync } from "@/hooks/canvas/useViewportSync";
import { useMarqueeSelection } from "@/hooks/canvas/useMarqueeSelection";
import { useTauriDragDrop } from "@/hooks/canvas/useTauriDragDrop";
import { useMenuHandlers } from "@/hooks/canvas/useMenuHandlers";
import { useFitView } from "@/hooks/canvas/useFitView";
import {
  IMAGE_PREVIEW_FOCUS_DURATION_MS,
  useFocusMediaNodeViewport,
} from "@/hooks/canvas/useFocusMediaNodeViewport";
import { useHoverEdge } from "@/hooks/canvas/useHoverEdge";

function FlowCanvasInner() {
  const projectPath = useProjectStore((s) => s.projectPath);
  const nodes = useProjectStore(useShallow((s) => s.nodes));
  const edges = useProjectStore(useShallow((s) => s.edges));
  const nodeRunStateById = useProjectStore(useShallow((s) => s.nodeRunStateById));
  const viewport = useProjectStore((s) => s.viewport);
  const onNodesChange = useProjectStore((s) => s.onNodesChange);
  const onEdgesChange = useProjectStore((s) => s.onEdgesChange);
  const onConnect = useProjectStore((s) => s.onConnect);
  const setSelectedNodeId = useProjectStore((s) => s.setSelectedNodeId);
  const setSelectedNodeIds = useProjectStore((s) => s.setSelectedNodeIds);
  const setSelectedEdgeIds = useProjectStore((s) => s.setSelectedEdgeIds);
  const selectedEdgeIds = useProjectStore((s) => s.selectedEdgeIds);
  const commitViewport = useProjectStore((s) => s.commitViewport);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const selectNodesByIds = useProjectStore((s) => s.selectNodesByIds);
  const importMediaFiles = useProjectStore((s) => s.importMediaFiles);
  const addNode = useProjectStore((s) => s.addNode);
  const copySelection = useProjectStore((s) => s.copySelection);
  const pasteSelection = useProjectStore((s) => s.pasteSelection);
  const deleteSelection = useProjectStore((s) => s.deleteSelection);
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const isGraphRunning = useProjectStore((s) => s.isGraphRunning);
  const queryClient = useQueryClient();
  const reactFlow = useReactFlow();
  const { screenToFlowPosition, getViewport, setViewport, getIntersectingNodes } = reactFlow;

  const menuAnchorRef = useRef({ x: 0, y: 0 });
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [menuState, setMenuState] = useState<FlowCanvasMenuState | null>(null);
  const [importing, setImporting] = useState(false);
  const [leftAddDockOpen, setLeftAddDockOpen] = useState(false);
  const [subjectCreationNodeId, setSubjectCreationNodeId] = useState<string | null>(null);
  const subjectPanelNodeIdRef = useRef<string | null>(null);
  const viewportInteractClearTimerRef = useRef<number | undefined>(undefined);
  const lastNodeContextMenuRef = useRef<{ nodeId: string; t: number } | null>(null);
  const setNodeDragSuppressUi = useCanvasUiStore((s) => s.setNodeDragSuppressUi);
  const setMaximizedNodeId = useCanvasUiStore((s) => s.setMaximizedNodeId);
  const setAudioTtsPanelNodeId = useCanvasUiStore((s) => s.setAudioTtsPanelNodeId);
  const setAudioTtsPanelPinnedNodeId = useCanvasUiStore((s) => s.setAudioTtsPanelPinnedNodeId);
  const setAudioTtsPanelExpandedNodeId = useCanvasUiStore((s) => s.setAudioTtsPanelExpandedNodeId);
  const setViewportInteracting = useCanvasUiStore((s) => s.setViewportInteracting);
  const minimapVisible = useCanvasUiStore((s) => s.minimapVisible);
  const nodeSnapVisual = useCanvasUiStore((s) => s.nodeSnapVisual);

  // ── Hooks ─────────────────────────────────────────────────────────────────

  const { isValidConnection } = useIsValidConnection();

  const onConnectStart: OnConnectStart = useCallback((_event, params) => {
    if (!params.nodeId || !params.handleType) return;
    useCanvasUiStore.getState().setAnchorConnectDrag({
      nodeId: params.nodeId,
      handleType: params.handleType,
    });
  }, []);

  const handleConnect = useCallback(
    (connection: Parameters<typeof onConnect>[0]) => {
      clearAnchorMenuSession();
      onConnect(connection);
    },
    [onConnect],
  );

  const onConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      const ui = useCanvasUiStore.getState();
      const drag = ui.anchorConnectDrag;
      ui.setAnchorConnectDrag(null);
      if (!drag) return;

      if (connectionState.isValid === true) {
        ui.setPendingAnchorConnection(null);
        return;
      }

      const clientX = "clientX" in event ? event.clientX : 0;
      const clientY = "clientY" in event ? event.clientY : 0;
      const releaseFlow = screenToFlowPosition({ x: clientX, y: clientY });
      const direction = drag.handleType === "source" ? "outgoing" : "incoming";

      ui.setPendingAnchorConnection({
        anchorNodeId: drag.nodeId,
        handleType: drag.handleType,
        releaseFlow,
      });
      ui.setAnchorMenuRequest({
        nodeId: drag.nodeId,
        direction,
        x: clientX,
        y: clientY,
      });
    },
    [screenToFlowPosition],
  );

  const { viewportProgrammaticSyncRef } = useViewportSync({
    viewport,
    getViewport,
    setViewport,
  });

  const { marqueeRect, suppressPaneContextRef } = useMarqueeSelection({
    wrapRef,
    screenToFlowPosition,
    getIntersectingNodes,
    nodes,
    selectNodesByIds,
  });

  const { dragging, setDragging } = useTauriDragDrop({
    wrapRef,
    screenToFlowPosition,
    importMediaFiles,
    setStatusText,
  });

  const {
    openAddPanelAt,
    openPaneContextAt,
    openNodeContextAt,
    openEdgeContextAt,
    openGalleryFromDock,
    openSubjectCreationAt,
  } = useMenuHandlers({
    setMenuState,
    setSubjectCreationNodeId,
    subjectPanelNodeIdRef,
  });

  const { fitViewToNode } = useFitView();
  const { focusMediaNodeAt200 } = useFocusMediaNodeViewport();

  const focusMediaNodeViewport = useCallback(
    async (nodeId: string) => {
      viewportProgrammaticSyncRef.current = true;
      const ok = await focusMediaNodeAt200(nodeId);
      if (ok) {
        commitViewport(getViewport());
      }
      window.setTimeout(() => {
        viewportProgrammaticSyncRef.current = false;
      }, IMAGE_PREVIEW_FOCUS_DURATION_MS + 80);
    },
    [commitViewport, focusMediaNodeAt200, getViewport, viewportProgrammaticSyncRef],
  );

  const { edgeView, nodesView, summarizeEdgePayload } = useEdgeViewModel({
    nodes,
    edges,
    selectedEdgeIds,
    nodeRunStateById,
    hoverEdge: null,
  });

  const { hoverEdge, setHoverEdge, syncHoverEdge } = useHoverEdge({
    summarizeEdgePayload,
  });

  // ── Gallery query ──────────────────────────────────────────────────────

  const galleryOpen = Boolean(
    menuState?.mode === "add-panel" && menuState.addPanelTab === "gallery" && projectPath,
  );

  const {
    data: galleryAssets,
    isLoading: galleryLoading,
    isError: galleryIsError,
    error: galleryQueryError,
  } = useQuery({
    queryKey: projectPath ? queryKeys.assets.list(projectPath) : ["assets", "__none__"],
    queryFn: () => listAssets(projectPath!, ASSET_LIST_DEFAULT_LIMIT),
    enabled: galleryOpen && Boolean(projectPath),
    select: (rows) => sortAssetsForGallery(rows),
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });

  const galleryError =
    galleryIsError && galleryQueryError
      ? galleryQueryError instanceof Error
        ? galleryQueryError
        : new Error(String(galleryQueryError))
      : null;

  // ── Callbacks ─────────────────────────────────────────────────────────

  const invalidateProjectAssets = useCallback(async () => {
    if (projectPath) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.assets.list(projectPath) });
    }
  }, [projectPath, queryClient]);

  /** 桌面端用系统对话框拿绝对路径；浏览器仍走隐藏 file input */
  const onRequestUploadFiles = useCallback(async () => {
    if (isTauri()) {
      const paths = await pickMediaPathsForImport(true);
      if (!paths?.length) return;
      const fallbackX = menuAnchorRef.current.x || 220;
      const fallbackY = menuAnchorRef.current.y || 180;
      const pos = screenToFlowPosition({ x: fallbackX, y: fallbackY });
      try {
        setImporting(true);
        await importMediaFiles(paths, pos);
        await invalidateProjectAssets();
      } catch (e) {
        setStatusText(`上传导入失败：${formatUserError(e)}`);
      } finally {
        setImporting(false);
      }
    } else {
      fileInputRef.current?.click();
    }
  }, [importMediaFiles, invalidateProjectAssets, screenToFlowPosition, setStatusText]);

  const onMoveEnd = useCallback(
    (_: unknown, vp: Viewport) => {
      if (viewportInteractClearTimerRef.current !== undefined) {
        window.clearTimeout(viewportInteractClearTimerRef.current);
      }
      viewportInteractClearTimerRef.current = window.setTimeout(() => {
        setViewportInteracting(false);
      }, 120);
      if (viewportProgrammaticSyncRef.current) return;
      commitViewport(vp);
    },
    [commitViewport, setViewportInteracting, viewportProgrammaticSyncRef],
  );

  const onMove = useCallback(() => {
    if (viewportProgrammaticSyncRef.current) return;
    if (viewportInteractClearTimerRef.current !== undefined) {
      window.clearTimeout(viewportInteractClearTimerRef.current);
      viewportInteractClearTimerRef.current = undefined;
    }
    setViewportInteracting(true);
  }, [setViewportInteracting, viewportProgrammaticSyncRef]);

  const onSelectionChange = useCallback(
    ({ nodes: selNodes = [], edges: selEdges = [] }: { nodes?: { id: string }[]; edges?: { id: string }[] }) => {
      const ids = selNodes.map((n) => n.id);
      setSelectedNodeIds(ids);
      setSelectedNodeId(selNodes[0]?.id ?? null);
      setSelectedEdgeIds(selEdges.map((e) => e.id));
      if (ids.length > 1) {
        setAudioTtsPanelNodeId(null);
      }
    },
    [setSelectedEdgeIds, setSelectedNodeId, setSelectedNodeIds, setAudioTtsPanelNodeId],
  );

  const onDropFiles = useCallback(
    async (ev: DragEvent<HTMLDivElement>) => {
      ev.preventDefault();
      setDragging(false);
      setImporting(true);
      try {
        const files = Array.from(ev.dataTransfer.files ?? []);
        const paths = files
          .map((f) => (f as File & { path?: string }).path)
          .filter(Boolean) as string[];
        if (paths.length === 0) return;
        const rect = wrapRef.current?.getBoundingClientRect();
        const x = ev.clientX - (rect?.left ?? 0);
        const y = ev.clientY - (rect?.top ?? 0);
        const pos = screenToFlowPosition({ x, y });
        await importMediaFiles(paths, pos);
        await invalidateProjectAssets();
      } catch (e) {
        setStatusText(`拖拽导入失败：${formatUserError(e)}`);
      } finally {
        setImporting(false);
      }
    },
    [importMediaFiles, invalidateProjectAssets, screenToFlowPosition, setStatusText],
  );

  const createNodeAtClientPoint = useCallback(
    (
      type: "textNode" | "imageNode" | "videoNode" | "audioNode" | "scriptNode" | "ffmpegConcat",
      clientX: number,
      clientY: number,
    ) => {
      const pos = screenToFlowPosition({ x: clientX, y: clientY });
      addNode({
        id: crypto.randomUUID(),
        type,
        position: pos,
        data: newNodeDataByType[type](),
      });
    },
    [addNode, screenToFlowPosition],
  );

  const pickAssetFromGallery = useCallback(
    (asset: Pick<AssetSummary, "relPath" | "mediaType" | "assetId">) => {
      const kind = assetNodeKindForMediaType(asset.mediaType);
      if (!kind) {
        setStatusText("该素材无法创建为媒体块（仅支持图片 / 视频 / 音频）");
        return;
      }
      const { x, y } = menuAnchorRef.current;
      const pos = screenToFlowPosition({ x, y });
      const labelByKind = {
        imageNode: "图片",
        videoNode: "视频",
        audioNode: "音频",
      } as const;
      addNode({
        id: crypto.randomUUID(),
        type: kind,
        position: pos,
        data: { label: labelByKind[kind], path: asset.relPath, assetId: asset.assetId },
      });
      setMenuState(null);
    },
    [addNode, screenToFlowPosition, setStatusText],
  );

  const syncMaterialsIndex = useCallback(async () => {
    if (!projectPath) {
      setStatusText("请先打开工程");
      return;
    }
    try {
      const n = await syncAssetsIndex(projectPath);
      setStatusText(`已同步 ${n} 个文件到素材索引`);
      await invalidateProjectAssets();
    } catch (e) {
      setStatusText(`同步素材索引失败：${formatUserError(e)}`);
    }
  }, [invalidateProjectAssets, projectPath, setStatusText]);

  const closeMenu = useCallback(() => setMenuState(null), []);

  // ── Effects ─────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (viewportInteractClearTimerRef.current !== undefined) {
        window.clearTimeout(viewportInteractClearTimerRef.current);
      }
      setViewportInteracting(false);
    };
  }, [setViewportInteracting]);

  useEffect(() => {
    if (menuState) {
      menuAnchorRef.current = { x: menuState.x, y: menuState.y };
    }
  }, [menuState]);

  // ── JSX ─────────────────────────────────────────────────────────────────

  return (
    <div
      className={`canvasWrap${nodeSnapVisual ? " canvasWrap--node-snap-active" : ""}`}
      ref={wrapRef}
      onDoubleClickCapture={(ev) => {
        const target = ev.target as HTMLElement | null;
        const onPane = Boolean(target?.closest(".react-flow__pane"));
        const onNode = Boolean(target?.closest(".react-flow__node"));
        const onEdge = Boolean(target?.closest(".react-flow__edge"));
        if (onPane && !onNode && !onEdge) {
          ev.preventDefault();
          ev.stopPropagation();
          openAddPanelAt(ev.clientX, ev.clientY);
        }
      }}
      onDragOver={(ev) => {
        ev.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(ev) => {
        if (isTauri()) {
          ev.preventDefault();
          setDragging(false);
          return;
        }
        void onDropFiles(ev);
      }}
    >
      <ReactFlow
        key={projectPath ?? "no-project"}
        nodes={nodesView}
        edges={edgeView}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        isValidConnection={isValidConnection}
        nodesConnectable={!isGraphRunning}
        edgesReconnectable={!isGraphRunning}
        connectionRadius={28}
        connectionLineComponent={CustomConnectionLine}
        onMove={onMove}
        onMoveEnd={onMoveEnd}
        onSelectionChange={onSelectionChange}
        onNodeClick={(_, node) => {
          setSelectedNodeIds([node.id]);
          setSelectedNodeId(node.id);
          setSelectedEdgeIds([]);
          setMenuState(null);
          if (node.type !== "audioNode") {
            setAudioTtsPanelNodeId(null);
          } else {
            const hasAsset = Boolean(node.data.path?.trim() || node.data.assetId?.trim());
            if (!hasAsset) {
              setAudioTtsPanelNodeId(node.id);
            } else {
              const opened = useCanvasUiStore.getState().audioTtsPanelNodeId;
              if (opened && opened !== node.id) setAudioTtsPanelNodeId(null);
            }
          }
        }}
        onNodeDoubleClick={(e, node) => {
          const t = e.target as HTMLElement | null;
          if (
            t?.closest("textarea") ||
            t?.closest("input:not([type='checkbox']):not([type='radio'])") ||
            t?.closest("[contenteditable='true']")
          ) {
            return;
          }
          setSelectedNodeIds([node.id]);
          setSelectedNodeId(node.id);
          setSelectedEdgeIds([]);
          setMenuState(null);
          if (node.type !== "audioNode") {
            setAudioTtsPanelNodeId(null);
          }
          if (node.type === "imageNode" || node.type === "videoNode") {
            void focusMediaNodeViewport(node.id);
          } else if (node.type === "audioNode") {
            const passive = isPassiveAudioAsset(node.id, nodes, edges);
            if (!passive) {
              setAudioTtsPanelNodeId(node.id);
            }
            void fitViewToNode(node.id);
          } else {
            void fitViewToNode(node.id);
          }
        }}
        onEdgeClick={(_, edge) => {
          setSelectedNodeIds([]);
          setSelectedNodeId(null);
          setSelectedEdgeIds([edge.id]);
          setMenuState(null);
        }}
        onEdgeContextMenu={(ev, edge) => {
          ev.preventDefault();
          setSelectedNodeIds([]);
          setSelectedNodeId(null);
          const alreadySelected = selectedEdgeIds.includes(edge.id);
          if (!alreadySelected) {
            setSelectedEdgeIds([edge.id]);
          }
          openEdgeContextAt(ev.clientX, ev.clientY, edge.id);
        }}
        onEdgeMouseEnter={(ev, edge) => {
          syncHoverEdge(ev.clientX, ev.clientY, edge);
        }}
        onEdgeMouseMove={(ev, edge) => {
          syncHoverEdge(ev.clientX, ev.clientY, edge);
        }}
        onEdgeMouseLeave={() => setHoverEdge(null)}
        onPaneClick={() => {
          setHoverEdge(null);
          setSelectedNodeIds([]);
          setSelectedNodeId(null);
          setSelectedEdgeIds([]);
          setMenuState(null);
          setAudioTtsPanelNodeId(null);
          setAudioTtsPanelPinnedNodeId(null);
          setAudioTtsPanelExpandedNodeId(null);
          setLeftAddDockOpen(false);
        }}
        onPaneContextMenu={(ev) => {
          ev.preventDefault();
          if (suppressPaneContextRef.current) {
            suppressPaneContextRef.current = false;
            return;
          }
          openPaneContextAt(ev.clientX, ev.clientY);
        }}
        onNodeContextMenu={(ev, node) => {
          const target = ev.target as HTMLElement | null;
          const onEditable =
            Boolean(
              target?.closest(
                "input, textarea, [contenteditable='true'], [contenteditable='plaintext-only'], .scriptGenComposerInput",
              ),
            ) || target?.isContentEditable === true;
          if (onEditable) {
            return;
          }
          const now = Date.now();
          const prev = lastNodeContextMenuRef.current;
          if (prev && prev.nodeId === node.id && now - prev.t < 480) {
            ev.preventDefault();
            ev.stopPropagation();
            lastNodeContextMenuRef.current = null;
            setMenuState(null);
            setAudioTtsPanelNodeId(null);
            if (node.type === "imageNode" || node.type === "videoNode") {
              void focusMediaNodeViewport(node.id);
            } else {
              setMaximizedNodeId(node.id);
            }
            return;
          }
          lastNodeContextMenuRef.current = { nodeId: node.id, t: now };

          if (node.type === "audioNode") {
            ev.preventDefault();
            ev.stopPropagation();
            setSelectedNodeIds([node.id]);
            setSelectedNodeId(node.id);
            setSelectedEdgeIds([]);
            setMenuState(null);
            setAudioTtsPanelNodeId(node.id);
            return;
          }

          ev.preventDefault();
          setSelectedNodeIds([node.id]);
          setSelectedNodeId(node.id);
          setSelectedEdgeIds([]);
          openNodeContextAt(ev.clientX, ev.clientY, node.id);
        }}
        onNodeDragStart={() => {
          setNodeDragSuppressUi(true);
        }}
        onNodeDragStop={() => {
          setNodeDragSuppressUi(false);
        }}
        onSelectionDragStart={() => {
          setNodeDragSuppressUi(true);
        }}
        onSelectionDragStop={() => {
          setNodeDragSuppressUi(false);
        }}
        nodeTypes={nodeTypes satisfies NodeTypes}
        fitView={false}
        defaultViewport={viewport}
        panOnDrag={false}
        selectionOnDrag
        zoomOnDoubleClick={false}
        defaultEdgeOptions={{
          animated: true,
          style: { strokeWidth: 2, stroke: "#60a5fa" },
        }}
        proOptions={{ hideAttribution: true }}
        onlyRenderVisibleElements
        minZoom={0.15}
        maxZoom={3}
        noWheelClassName="nowheel"
        noPanClassName="nopan"
      >
        <Background gap={18} size={1} color="#2a3140" />
        {minimapVisible ? (
          <MiniMap pannable zoomable position="bottom-right" style={{ margin: 10 }} />
        ) : null}
        <CanvasFlowChrome />
        <NodeSnapGuideOverlay />
        <Panel position="center-left" style={{ margin: 10 }}>
          <LeftAddDock
            open={leftAddDockOpen}
            onOpen={() => setLeftAddDockOpen(true)}
            onClose={() => setLeftAddDockOpen(false)}
            projectPath={projectPath}
            onRequestUploadFiles={onRequestUploadFiles}
            onOpenGallery={openGalleryFromDock}
          />
        </Panel>
      </ReactFlow>

      <PendingConnectionOverlay />
      <FlowConnectHint />
      {marqueeRect ? (
        <div
          className="canvasMarqueeRect"
          style={{
            position: "fixed",
            left: marqueeRect.x,
            top: marqueeRect.y,
            width: marqueeRect.w,
            height: marqueeRect.h,
            pointerEvents: "none",
            zIndex: 44,
          }}
          aria-hidden
        />
      ) : null}
      <SelectionBoundsOverlay marqueeActive={Boolean(marqueeRect)} />
      <MultiSelectionToolbar marqueeActive={Boolean(marqueeRect)} />
      <NodeSelectionToolbar />
      <MarkerToolbar />
      {dragging || importing ? (
        <div
          style={{
            position: "absolute",
            inset: 12,
            border: `1px dashed ${importing ? "var(--accent-2)" : "var(--accent)"}`,
            borderRadius: 12,
            background: "rgba(59,130,246,0.08)",
            display: "grid",
            placeItems: "center",
            pointerEvents: "none",
            zIndex: FLOW_MENU.dropOverlayZIndex,
            color: "var(--text)",
            fontSize: 13,
          }}
        >
          {importing ? "正在导入素材，请稍候…" : "释放鼠标导入图片/视频/音频到 assets 并自动创建素材块"}
        </div>
      ) : null}
      {hoverEdge ? (
        <div
          className="flowEdgeHoverTooltip mono"
          style={{
            position: "fixed",
            left: hoverEdge.x + 14,
            top: hoverEdge.y + 14,
            zIndex: FLOW_MENU.dropOverlayZIndex + 2,
            pointerEvents: "none",
          }}
        >
          {hoverEdge.summary}
        </div>
      ) : null}
      {menuState ? (
        <CanvasContextMenus
          menuState={menuState}
          projectPath={projectPath}
          galleryAssets={galleryAssets}
          galleryLoading={galleryLoading}
          galleryError={galleryError}
          onDismiss={closeMenu}
          onRequestUploadFiles={onRequestUploadFiles}
          openAddPanelAt={openAddPanelAt}
          createNodeAtClientPoint={createNodeAtClientPoint}
          pickAssetFromGallery={pickAssetFromGallery}
          syncMaterialsIndex={syncMaterialsIndex}
          copySelection={copySelection}
          pasteSelection={pasteSelection}
          deleteSelection={deleteSelection}
          focusNodesByIds={async (ids) => {
            try {
              await reactFlow.fitView({
                nodes: ids.map((id) => ({ id })),
                padding: 0.18,
                duration: 320,
                minZoom: 0.15,
                maxZoom: 3,
              });
            } catch {
              // 忽略极端视口参数下的 fitView 失败
            }
          }}
          undo={undo}
          redo={redo}
          setMenuState={setMenuState}
          onOpenSubjectCreation={openSubjectCreationAt}
        />
      ) : null}
      <NodeMaximizedOverlay />
      <ImageGenerationPanelExpandedModal />
      <VideoGenerationPanelExpandedModal />
      <TextComposerPanelExpandedModal />
      <AudioTtsPanelExpandedModal />
      <SubjectCreationPanel
        open={subjectCreationNodeId !== null}
        nodeId={subjectCreationNodeId ?? ""}
        onClose={() => setSubjectCreationNodeId(null)}
        onSubjectsChanged={() => useCanvasUiStore.getState().bumpSubjectListVersion()}
      />
      <FileInputHandler
        fileInputRef={fileInputRef}
        screenToFlowPosition={screenToFlowPosition}
        menuAnchorRef={menuAnchorRef}
        importMediaFiles={importMediaFiles}
        invalidateProjectAssets={invalidateProjectAssets}
        setStatusText={setStatusText}
      />
    </div>
  );
}

export function FlowCanvas() {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner />
    </ReactFlowProvider>
  );
}
