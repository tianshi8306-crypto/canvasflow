import {
  Background,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type NodeTypes,
  useReactFlow,
  useStore,
  type Viewport,
} from "@xyflow/react";
import { isTauri } from "@tauri-apps/api/core";
import { PhysicalPosition } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { MultiSelectionToolbar } from "@/components/canvas/MultiSelectionToolbar";
import { NodeSelectionToolbar } from "@/components/canvas/NodeSelectionToolbar";
import { MarkerToolbar } from "@/components/canvas/MarkerToolbar";
import { SelectionBoundsOverlay } from "@/components/canvas/SelectionBoundsOverlay";
import { CanvasContextMenus } from "@/components/canvas/CanvasContextMenus";
import { FLOW_MENU } from "@/components/canvas/menuConstants";
import type { FlowCanvasMenuState } from "@/components/canvas/flowCanvasMenuState";
import { assetNodeKindForMediaType, ASSET_LIST_DEFAULT_LIMIT, sortAssetsForGallery } from "@/lib/canvasAssets";
import { validateConnection, connectionRejectedReason } from "@/lib/flowConnectionPolicy";
import { newNodeDataByType } from "@/lib/canvasNodeDefaults";
import { clampContextMenuPosition } from "@/lib/clampFloatingUi";
import { formatUserError } from "@/lib/errors";
import { pickMediaPathsForImport } from "@/lib/tauriMediaPaths";
import { useEdgeViewModel, type EdgeHoverState } from "@/hooks/useEdgeViewModel";
import { isEdgeDisabled } from "@/lib/edgeState";
import { listAssets, syncAssetsIndex, type AssetSummary } from "@/shared/api/assets";
import { queryKeys } from "@/shared/queryKeys";
import { useProjectStore } from "@/store/projectStore";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { CanvasFlowChrome } from "@/components/canvas/CanvasFlowChrome";
import { NodeMaximizedOverlay } from "@/components/canvas/NodeMaximizedOverlay";
import { SubjectCreationPanel } from "@/components/SubjectCreationPanel";
import { LeftAddDock } from "@/components/LeftAddDock";
import { FFmpegNode } from "@/components/nodes/FFmpegNode";
import { ImageAssetNode } from "@/components/nodes/ImageAssetNode";
import { LLMNode } from "@/components/nodes/LLMNode";
import { MediaImportNode } from "@/components/nodes/MediaImportNode";
import { TextNode } from "@/components/nodes/TextNode";
import { ScriptNode } from "@/components/nodes/ScriptNode";
import { VideoAssetNode } from "@/components/nodes/VideoAssetNode";
import { AudioAssetNode } from "@/components/nodes/AudioAssetNode";
import { GroupNode } from "@/components/nodes/GroupNode";

const nodeTypes = {
  llm: LLMNode,
  mediaImport: MediaImportNode,
  imageAsset: ImageAssetNode,
  ffmpegConcat: FFmpegNode,
  textNode: TextNode,
  scriptNode: ScriptNode,
  imageNode: ImageAssetNode,
  videoNode: VideoAssetNode,
  audioNode: AudioAssetNode,
  group: GroupNode,
} satisfies NodeTypes;

function FlowCanvasInner() {
  const projectPath = useProjectStore((s) => s.projectPath);
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const nodeRunStateById = useProjectStore((s) => s.nodeRunStateById);
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
  /** 避免 store→setViewport 触发的 onMoveEnd 再次 commit，形成视口抖动/死循环卡死主线程 */
  const viewportProgrammaticSyncRef = useRef(false);

  /** M2：拖拽连线时预览合法边；非法边不会落地（与 store.onConnect 一致） */
  const isValidConnection = useCallback((c: Edge | Connection) => {
    if (isGraphRunning) return false;
    const state = useProjectStore.getState();
    const v = {
      source: c.source!,
      target: c.target!,
      sourceHandle: c.sourceHandle ?? null,
      targetHandle: c.targetHandle ?? null,
    };
    return validateConnection(v, state.nodes, state.edges).ok;
  }, [isGraphRunning]);

  useEffect(() => {
    let cancelled = false;
    const cur = getViewport();
    if (
      Math.abs(cur.x - viewport.x) < 0.5 &&
      Math.abs(cur.y - viewport.y) < 0.5 &&
      Math.abs(cur.zoom - viewport.zoom) < 0.0001
    ) {
      return;
    }
    viewportProgrammaticSyncRef.current = true;
    void (async () => {
      try {
        await setViewport(viewport);
      } finally {
        window.setTimeout(() => {
          if (!cancelled) viewportProgrammaticSyncRef.current = false;
        }, 120);
      }
    })();
    return () => {
      cancelled = true;
      viewportProgrammaticSyncRef.current = false;
    };
    // getViewport / setViewport 来自稳定的 RF 实例；仅响应 Zustand 中的视口（撤销/重做等）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewport]);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [menuState, setMenuState] = useState<FlowCanvasMenuState | null>(null);
  const [hoverEdge, setHoverEdge] = useState<EdgeHoverState | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [leftAddDockOpen, setLeftAddDockOpen] = useState(false);
  const [subjectCreationNodeId, setSubjectCreationNodeId] = useState<string | null>(null);
  const subjectPanelNodeIdRef = useRef<string | null>(null);
  const connectionHint = useStore((s) => s.connection);
  const marqueeDragRef = useRef<{ sx: number; sy: number } | null>(null);
  const marqueeGeomRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const suppressPaneContextRef = useRef(false);
  const viewportInteractClearTimerRef = useRef<number | undefined>(undefined);
  /** 节点上连续两次 contextmenu（右键）间隔短则视为双击 → 最大化 */
  const lastNodeContextMenuRef = useRef<{ nodeId: string; t: number } | null>(null);
  const setNodeDragSuppressUi = useCanvasUiStore((s) => s.setNodeDragSuppressUi);
  const setMaximizedNodeId = useCanvasUiStore((s) => s.setMaximizedNodeId);
  const setAudioTtsPanelNodeId = useCanvasUiStore((s) => s.setAudioTtsPanelNodeId);
  const setViewportInteracting = useCanvasUiStore((s) => s.setViewportInteracting);
  const minimapVisible = useCanvasUiStore((s) => s.minimapVisible);

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

  /** 画布空白处按住右键拖拽框选（与 React Flow 内置左键框选独立） */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 2) return;
      const t = e.target as HTMLElement | null;
      if (!t?.closest(".react-flow__pane")) return;
      if (t.closest(".react-flow__node") || t.closest(".react-flow__edge")) return;
      e.preventDefault();
      e.stopPropagation();
      marqueeDragRef.current = { sx: e.clientX, sy: e.clientY };
      const g = { x: e.clientX, y: e.clientY, w: 0, h: 0 };
      marqueeGeomRef.current = g;
      setMarqueeRect(g);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!marqueeDragRef.current) return;
      e.preventDefault();
      const { sx, sy } = marqueeDragRef.current;
      const x = Math.min(sx, e.clientX);
      const y = Math.min(sy, e.clientY);
      const w = Math.abs(e.clientX - sx);
      const h = Math.abs(e.clientY - sy);
      const g = { x, y, w, h };
      marqueeGeomRef.current = g;
      setMarqueeRect(g);
    };

    const finishMarquee = () => {
      if (!marqueeDragRef.current) return;
      marqueeDragRef.current = null;
      const r = marqueeGeomRef.current;
      marqueeGeomRef.current = null;
      setMarqueeRect(null);
      if (!r || r.w < 8 || r.h < 8) return;
      const p1 = screenToFlowPosition({ x: r.x, y: r.y });
      const p2 = screenToFlowPosition({ x: r.x + r.w, y: r.y + r.h });
      const rect = {
        x: Math.min(p1.x, p2.x),
        y: Math.min(p1.y, p2.y),
        width: Math.abs(p2.x - p1.x),
        height: Math.abs(p2.y - p1.y),
      };
      const intersecting = getIntersectingNodes(rect, true, nodes);
      const ids = intersecting.map((n) => n.id);
      if (ids.length > 0) {
        suppressPaneContextRef.current = true;
        selectNodesByIds(ids);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!marqueeDragRef.current) return;
      if (e.pointerType === "mouse" && e.button !== 2) return;
      finishMarquee();
    };

    const onPointerCancel = () => {
      if (!marqueeDragRef.current) return;
      marqueeDragRef.current = null;
      marqueeGeomRef.current = null;
      setMarqueeRect(null);
    };

    el.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("pointercancel", onPointerCancel, true);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("pointercancel", onPointerCancel, true);
    };
  }, [getIntersectingNodes, nodes, screenToFlowPosition, selectNodesByIds]);

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
        : new Error(formatUserError(galleryQueryError))
      : null;

  const invalidateProjectAssets = useCallback(async () => {
    if (projectPath) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.assets.list(projectPath) });
    }
  }, [projectPath, queryClient]);

  /** 桌面端用系统对话框拿绝对路径；浏览器仍走隐藏 file input（通常无 path，仅作占位） */
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

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    void getCurrentWebview()
      .onDragDropEvent((event) => {
        const payload = event.payload;
        if (payload.type === "enter" || payload.type === "over") {
          setDragging(true);
        } else if (payload.type === "leave") {
          setDragging(false);
        } else if (payload.type === "drop") {
          setDragging(false);
          const paths = payload.paths;
          if (paths.length === 0) return;
          void (async () => {
            setImporting(true);
            try {
              const factor = await getCurrentWindow().scaleFactor();
              const logical = new PhysicalPosition(payload.position.x, payload.position.y).toLogical(factor);
              const rect = wrapRef.current?.getBoundingClientRect();
              if (!rect) return;
              const x = logical.x - rect.left;
              const y = logical.y - rect.top;
              const pos = screenToFlowPosition({ x, y });
              await importMediaFiles(paths, pos);
              await invalidateProjectAssets();
            } catch (e) {
              setStatusText(`拖拽导入失败：${formatUserError(e)}`);
            } finally {
              setImporting(false);
            }
          })();
        }
      })
      .then((fn) => {
        unlisten = fn;
      });
    return () => {
      unlisten?.();
    };
  }, [importMediaFiles, invalidateProjectAssets, screenToFlowPosition, setStatusText]);

  const openAddPanelAt = useCallback((x: number, y: number, nodeId: string | null = null) => {
    const p = clampContextMenuPosition(x, y, FLOW_MENU.widths.contextPaneL2, FLOW_MENU.clampEstimatedHeight);
    setMenuState({ x: p.x, y: p.y, mode: "add-panel", nodeId, addPanelTab: "types" });
  }, []);

  const openPaneContextAt = useCallback((x: number, y: number) => {
    const p = clampContextMenuPosition(x, y, FLOW_MENU.widths.contextPaneL1, FLOW_MENU.clampEstimatedHeight);
    setMenuState({ x: p.x, y: p.y, mode: "context-pane", nodeId: null, paneAddSubmenu: false });
  }, []);

  const openNodeContextAt = useCallback((x: number, y: number, nodeId: string) => {
    const p = clampContextMenuPosition(x, y, FLOW_MENU.widths.context, FLOW_MENU.clampEstimatedHeight);
    setMenuState({ x: p.x, y: p.y, mode: "context-node", nodeId });
  }, []);

  const openEdgeContextAt = useCallback((x: number, y: number, edgeId: string) => {
    const p = clampContextMenuPosition(x, y, FLOW_MENU.widths.context, FLOW_MENU.clampEstimatedHeight);
    setMenuState({ x: p.x, y: p.y, mode: "context-edge", nodeId: null, edgeId });
  }, []);

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
    [commitViewport, setViewportInteracting],
  );

  const onMove = useCallback(() => {
    if (viewportProgrammaticSyncRef.current) return;
    if (viewportInteractClearTimerRef.current !== undefined) {
      window.clearTimeout(viewportInteractClearTimerRef.current);
      viewportInteractClearTimerRef.current = undefined;
    }
    setViewportInteracting(true);
  }, [setViewportInteracting]);

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
        const paths = files.map((f) => (f as File & { path?: string }).path).filter(Boolean) as string[];
        if (paths.length === 0) {
          return;
        }
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

  /** 左键双击节点：视口动画缩放，使该节点居中并尽量铺满可视区域 */
  const fitViewToNode = useCallback(
    async (nodeId: string) => {
      try {
        await reactFlow.fitView({
          nodes: [{ id: nodeId }],
          padding: 0.06,
          duration: 420,
          minZoom: 0.15,
          maxZoom: 3,
        });
      } catch {
        /* fitView 在极宽/极窄画布上可能失败，忽略 */
      }
    },
    [reactFlow],
  );

  const openGalleryFromDock = useCallback(() => {
    const p = clampContextMenuPosition(240, 200, FLOW_MENU.widths.gallery, FLOW_MENU.clampEstimatedHeight);
    setMenuState({ x: p.x, y: p.y, mode: "add-panel", nodeId: null, addPanelTab: "gallery" });
  }, []);

  const openSubjectCreationAt = useCallback((nodeId: string) => {
    subjectPanelNodeIdRef.current = nodeId;
    setSubjectCreationNodeId(nodeId);
  }, []);

  const { edgeView, nodesView, summarizeEdgePayload } = useEdgeViewModel({
    nodes,
    edges,
    selectedEdgeIds,
    nodeRunStateById,
    hoverEdge,
  });

  const syncHoverEdge = useCallback(
    (clientX: number, clientY: number, edge: Edge) => {
      const disabled = isEdgeDisabled(edge);
      const summary = summarizeEdgePayload(edge.source, edge.target, disabled);
      setHoverEdge((prev) =>
        prev && prev.edgeId === edge.id
          ? { ...prev, x: clientX, y: clientY, summary, disabled }
          : {
              edgeId: edge.id,
              sourceId: edge.source,
              targetId: edge.target,
              x: clientX,
              y: clientY,
              summary,
              disabled,
            },
      );
    },
    [summarizeEdgePayload],
  );

  return (
    <div
      className="canvasWrap"
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
        onConnect={onConnect}
        onConnectStart={() => {}}
        onConnectEnd={() => {}}
        isValidConnection={isValidConnection}
        nodesConnectable={!isGraphRunning}
        edgesReconnectable={!isGraphRunning}
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
          void fitViewToNode(node.id);
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
            ) ||
            target?.isContentEditable === true;
          // 文本编辑区右键优先走系统原生菜单（复制/粘贴文本），不弹画布节点菜单
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
            setMaximizedNodeId(node.id);
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
        nodeTypes={nodeTypes}
        fitView={false}
        defaultViewport={viewport}
        /* 仅按住空格时平移画布（与默认 panActivationKeyCode="Space" 组合） */
        panOnDrag={false}
        /* 不按 Shift：左键在空白处拖拽即可框选（与 panOnDrag=false 组合时，按住空格期间不会触发框选） */
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
      {connectionHint.inProgress && connectionHint.toNode ? (
        (() => {
          const reason = connectionRejectedReason(
            connectionHint.fromNode?.type ?? null,
            connectionHint.toNode?.type ?? null,
          );
          const isValid = connectionHint.isValid ?? false;
          const screenPos = reactFlow.flowToScreenPosition(connectionHint.pointer ?? { x: 0, y: 0 });
          return (
            <div
              className={`flowEdgeHoverTooltip mono ${isValid ? "flowConnectHint--valid" : "flowConnectHint--invalid"}`}
              style={{
                position: "fixed",
                left: screenPos.x + 14,
                top: screenPos.y - 40,
                zIndex: FLOW_MENU.dropOverlayZIndex + 3,
                pointerEvents: "none",
              }}
            >
              {isValid ? "可连接" : (reason ?? "类型不匹配")}
            </div>
          );
        })()
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
      <SubjectCreationPanel
        open={subjectCreationNodeId !== null}
        nodeId={subjectCreationNodeId ?? ""}
        onClose={() => setSubjectCreationNodeId(null)}
        onSubjectsChanged={() => useCanvasUiStore.getState().bumpSubjectListVersion()}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={(ev) => {
          const input = ev.currentTarget;
          const files = Array.from(input.files ?? []);
          const paths = files.map((f) => (f as File & { path?: string }).path).filter(Boolean) as string[];
          if (paths.length === 0) {
            input.value = "";
            return;
          }
          const fallbackX = menuAnchorRef.current.x || 220;
          const fallbackY = menuAnchorRef.current.y || 180;
          const pos = screenToFlowPosition({ x: fallbackX, y: fallbackY });
          void (async () => {
            try {
              await importMediaFiles(paths, pos);
              await invalidateProjectAssets();
            } catch (e) {
              setStatusText(`上传导入失败：${formatUserError(e)}`);
            } finally {
              input.value = "";
            }
          })();
        }}
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
