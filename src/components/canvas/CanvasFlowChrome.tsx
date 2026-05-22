import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { Panel, useReactFlow, useStore } from "@xyflow/react";
import type { Node, Edge } from "@xyflow/react";
import { useProjectStore } from "@/store/projectStore";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import "./ZoomMenu.css";
import { CanvasShortcutsOverlay } from "@/components/canvas/CanvasShortcutsOverlay";
import { TidyCanvasConfirmBar } from "@/components/canvas/TidyCanvasConfirmBar";
import {
  FloatMenuDivider,
  FloatMenuItem,
  FloatMenuSection,
  FloatMenuShell,
} from "@/components/canvas/CanvasFloatMenu";
import {
  IconFitScreen,
  IconZoomIn,
  IconZoomOut,
  IconZoomPreset,
} from "@/components/canvas/workspaceMenuIcons";
import { anchorMenuAboveTrigger } from "@/lib/clampFloatingUi";

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 3;

function isEditingTextField(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (typeof el.isContentEditable === "boolean" && el.isContentEditable) return true;
  return Boolean(el.closest(".canvasShortcutsOverlayCard"));
}

/** 小地图图标 - 简化网格+边框 */
function IconMinimap() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 7h4v4H7zM13 7h4v4h-4zM7 13h4v4H7z" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/** 整理画布图标 - 四个角向中心汇聚 */
function IconTidy() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 3l5 5M21 3l-5 5M3 21l5-5M21 21l-5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="8" y="8" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

/** 对齐吸附图标 - 横纵对齐线 */
function IconSnap() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 8h16M4 16h16M8 4v16M16 4v16" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    </svg>
  );
}

/** 帮助图标 - 问号 */
function IconHelp() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 9a3 3 0 1 1 3.5 2.9c-.5.3-.5.6-.5 1v1.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="17" r="0.8" fill="currentColor" />
    </svg>
  );
}

export function CanvasFlowChrome() {
  const minimapVisible = useCanvasUiStore((s) => s.minimapVisible);
  const setMinimapVisible = useCanvasUiStore((s) => s.setMinimapVisible);
  const nodeSnapAlignmentEnabled = useCanvasUiStore((s) => s.nodeSnapAlignmentEnabled);
  const setNodeSnapAlignmentEnabled = useCanvasUiStore((s) => s.setNodeSnapAlignmentEnabled);
  const setSnapGridEnabled = useCanvasUiStore((s) => s.setSnapGridEnabled);
  const shortcutsOverlayOpen = useCanvasUiStore((s) => s.shortcutsOverlayOpen);
  const setShortcutsOverlayOpen = useCanvasUiStore((s) => s.setShortcutsOverlayOpen);

  const { fitView, getViewport, setViewport } = useReactFlow();
  const commitViewport = useProjectStore((s) => s.commitViewport);
  const tidyCanvasLayout = useProjectStore((s) => s.tidyCanvasLayout);
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const selectedNodeIds = useProjectStore((s) => s.selectedNodeIds);
  const alignSelectedNodes = useProjectStore((s) => s.alignSelectedNodes);
  const distributeSelectedNodes = useProjectStore((s) => s.distributeSelectedNodes);
  const zoom = useStore((s) => s.transform[2]);
  const [zoomMenuOpen, setZoomMenuOpen] = useState(false);
  const [tidyConfirm, setTidyConfirm] = useState(false);
  const [tidyMovedCount, setTidyMovedCount] = useState(0);
  const tidyBeforeRef = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null); // 整理前的状态
  const zoomMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const zoomPercent = Math.round(zoom * 100);

  // 点击打开/关闭菜单
  const handleZoomMenuToggle = useCallback(() => {
    if (zoomMenuOpen) {
      setZoomMenuOpen(false);
    } else {
      setZoomMenuOpen(true);
    }
  }, [zoomMenuOpen]);

  const applyZoom = useCallback(
    (newZoom: number) => {
      const vp = getViewport();
      void setViewport({ ...vp, zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom)) }, { duration: 0 });
      commitViewport(getViewport());
    },
    [getViewport, setViewport, commitViewport],
  );

  const fitCanvasToView = useCallback(async () => {
    try {
      await fitView({ padding: 0.12, duration: 380, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM });
    } catch {
      /* fitView 在极端尺寸下可能失败 */
    }
    commitViewport(getViewport());
  }, [commitViewport, fitView, getViewport]);

  // 整理画布：宫格排列顶层节点 + 适配视口
  const tidyCanvas = useCallback(async () => {
    tidyBeforeRef.current = {
      nodes: JSON.parse(JSON.stringify(nodes)) as Node[],
      edges: JSON.parse(JSON.stringify(edges)) as Edge[],
    };
    const moved = tidyCanvasLayout();
    if (moved === 0) {
      tidyBeforeRef.current = null;
      return;
    }
    await fitCanvasToView();
    setTidyMovedCount(moved);
    setTidyConfirm(true);
  }, [nodes, edges, tidyCanvasLayout, fitCanvasToView]);

  const handleTidyUndo = useCallback(() => {
    if (tidyBeforeRef.current) {
      useProjectStore.setState({
        nodes: tidyBeforeRef.current.nodes,
        edges: tidyBeforeRef.current.edges,
        projectDirty: Boolean(useProjectStore.getState().projectPath),
      });
      tidyBeforeRef.current = null;
      void fitCanvasToView();
    }
    setTidyConfirm(false);
  }, [fitCanvasToView]);

  const handleTidyConfirm = useCallback(() => {
    tidyBeforeRef.current = null;
    setTidyConfirm(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (shortcutsOverlayOpen && e.key === "Escape") {
        e.preventDefault();
        setShortcutsOverlayOpen(false);
        return;
      }
      if (tidyConfirm) {
        if (e.key === "Escape") {
          e.preventDefault();
          handleTidyUndo();
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          handleTidyConfirm();
          return;
        }
      }
      if (isEditingTextField(e.target)) return;

      const key = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;

      if (!mod && !e.altKey && !e.shiftKey && key === "z") {
        e.preventDefault();
        void (async () => {
          try {
            await fitView({ padding: 0.12, duration: 320, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM });
          } catch {
            /* 极端视口下 fitView 可能失败 */
          }
          commitViewport(getViewport());
        })();
        return;
      }

      if (!mod && !e.altKey && !e.shiftKey && key === "f" && selectedNodeIds.length > 0) {
        e.preventDefault();
        void (async () => {
          try {
            await fitView({
              nodes: selectedNodeIds.map((id) => ({ id })),
              padding: 0.18,
              duration: 320,
              minZoom: MIN_ZOOM,
              maxZoom: MAX_ZOOM,
            });
          } catch {
            /* 忽略 */
          }
          commitViewport(getViewport());
        })();
        return;
      }

      if (e.altKey && e.shiftKey && key === "f") {
        e.preventDefault();
        void tidyCanvas();
        return;
      }
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        const on = useCanvasUiStore.getState().nodeSnapAlignmentEnabled;
        setNodeSnapAlignmentEnabled(!on);
        return;
      }
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === "m") {
        e.preventDefault();
        const v = useCanvasUiStore.getState().minimapVisible;
        setMinimapVisible(!v);
        return;
      }
      if (e.altKey && e.shiftKey && key === "g") {
        e.preventDefault();
        const on = useCanvasUiStore.getState().snapGridEnabled;
        setSnapGridEnabled(!on);
        return;
      }

      if (e.altKey && e.shiftKey) {
        const alignKeys: Record<string, Parameters<typeof alignSelectedNodes>[0]> = {
          l: "left",
          r: "right",
          t: "top",
          b: "bottom",
          h: "centerH",
          v: "centerV",
        };
        const alignOp = alignKeys[key];
        if (alignOp) {
          e.preventDefault();
          alignSelectedNodes(alignOp);
          return;
        }
        if (key === "e") {
          e.preventDefault();
          distributeSelectedNodes("horizontal");
          return;
        }
        if (key === "j") {
          e.preventDefault();
          distributeSelectedNodes("vertical");
          return;
        }
      }

      if (mod && !e.shiftKey && (key === "=" || key === "+")) {
        e.preventDefault();
        applyZoom(zoom + 0.1);
        return;
      }
      if (mod && !e.shiftKey && key === "-") {
        e.preventDefault();
        applyZoom(zoom - 0.1);
        return;
      }
      if (mod && !e.shiftKey && key === "0") {
        e.preventDefault();
        applyZoom(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    alignSelectedNodes,
    distributeSelectedNodes,
    setMinimapVisible,
    setNodeSnapAlignmentEnabled,
    setSnapGridEnabled,
    setShortcutsOverlayOpen,
    shortcutsOverlayOpen,
    tidyConfirm,
    handleTidyConfirm,
    handleTidyUndo,
    tidyCanvas,
    selectedNodeIds,
    fitView,
    getViewport,
    commitViewport,
    applyZoom,
    zoom,
  ]);

  // 点击外部关闭菜单
  useEffect(() => {
    if (!zoomMenuOpen) return;
    const handler = (e: MouseEvent) => {
      const trigger = zoomMenuTriggerRef.current;
      const menu = document.querySelector(".zoomMenu");
      if (trigger && (trigger === e.target || trigger.contains(e.target as HTMLElement))) return;
      if (menu && menu.contains(e.target as HTMLElement)) return;
      setZoomMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [zoomMenuOpen]);

  const fabOn = (pressed: boolean) => `leftAddDockFab${pressed ? "" : " leftAddDockFab--close"}`;

  return (
    <>
      <Panel position="bottom-left" className="canvasFlowChromeDock">
        <div className="canvasBottomDock" role="toolbar" aria-label="画布视图与缩放">
          <div className="canvasBottomDockRail">
            <button
              type="button"
              className={fabOn(minimapVisible)}
              title={minimapVisible ? "隐藏小地图" : "显示小地图"}
              aria-pressed={minimapVisible}
              onClick={() => setMinimapVisible(!minimapVisible)}
            >
              <IconMinimap />
            </button>
            <button
              type="button"
              className="leftAddDockFab"
              title="整理画布（宫格排列并适配视口）"
              onClick={() => tidyCanvas()}
            >
              <IconTidy />
            </button>
            <button
              type="button"
              className={fabOn(nodeSnapAlignmentEnabled)}
              title={nodeSnapAlignmentEnabled ? "对齐吸附已开启" : "对齐吸附已关闭"}
              aria-pressed={nodeSnapAlignmentEnabled}
              onClick={() => setNodeSnapAlignmentEnabled(!nodeSnapAlignmentEnabled)}
            >
              <IconSnap />
            </button>
            <div className="canvasBottomDockDivider" aria-hidden />
            <div className="canvasBottomDockZoom" title="缩放">
              <button
                type="button"
                className="zoomBtn"
                title="缩小"
                onClick={() => applyZoom(zoom - 0.1)}
                disabled={zoom <= MIN_ZOOM}
              >
                −
              </button>
              <button
                ref={zoomMenuTriggerRef}
                type="button"
                className="zoomPercentBtn"
                title="缩放选项"
                onClick={handleZoomMenuToggle}
              >
                {zoomPercent}%
                <span className="zoomCaret">▼</span>
              </button>
              <button
                type="button"
                className="zoomBtn"
                title="放大"
                onClick={() => applyZoom(zoom + 0.1)}
                disabled={zoom >= MAX_ZOOM}
              >
                +
              </button>
            </div>
            <button
              type="button"
              className="leftAddDockFab"
              title="快捷键说明"
              aria-expanded={shortcutsOverlayOpen}
              onClick={() => setShortcutsOverlayOpen(!shortcutsOverlayOpen)}
            >
              <IconHelp />
            </button>
          </div>
        </div>
      </Panel>
      {shortcutsOverlayOpen ? <CanvasShortcutsOverlay onClose={() => setShortcutsOverlayOpen(false)} /> : null}
      <TidyCanvasConfirmBar
        open={tidyConfirm}
        movedCount={tidyMovedCount}
        onUndo={handleTidyUndo}
        onConfirm={handleTidyConfirm}
      />

      {/* 缩放菜单 - Portal 渲染到 body */}
      {zoomMenuOpen && zoomMenuTriggerRef.current && (() => {
        const rect = zoomMenuTriggerRef.current.getBoundingClientRect();
        const menuW = 172;
        const pos = anchorMenuAboveTrigger(rect, menuW);
        const close = () => setZoomMenuOpen(false);
        const pct = Math.round(zoom * 100);
        return createPortal(
          <FloatMenuShell
            className="zoomMenu"
            aria-label="缩放"
            style={{ left: pos.left, bottom: pos.bottom, width: menuW }}
          >
            <FloatMenuSection>
              <FloatMenuItem
                icon={<IconZoomIn />}
                label="放大"
                onClick={() => {
                  applyZoom(zoom + 0.1);
                  close();
                }}
              />
              <FloatMenuItem
                icon={<IconZoomOut />}
                label="缩小"
                onClick={() => {
                  applyZoom(zoom - 0.1);
                  close();
                }}
              />
              <FloatMenuItem
                icon={<IconFitScreen />}
                label="适合屏幕"
                onClick={() => {
                  void fitCanvasToView();
                  close();
                }}
              />
            </FloatMenuSection>
            <FloatMenuDivider />
            <FloatMenuSection title="缩放比例">
              <FloatMenuItem
                icon={<IconZoomPreset />}
                label="50%"
                active={pct === 50}
                onClick={() => {
                  applyZoom(0.5);
                  close();
                }}
              />
              <FloatMenuItem
                icon={<IconZoomPreset />}
                label="100%"
                active={pct === 100}
                onClick={() => {
                  applyZoom(1);
                  close();
                }}
              />
              <FloatMenuItem
                icon={<IconZoomPreset />}
                label="200%"
                active={pct === 200}
                onClick={() => {
                  applyZoom(2);
                  close();
                }}
              />
            </FloatMenuSection>
          </FloatMenuShell>,
          document.body,
        );
      })()}
    </>
  );
}
