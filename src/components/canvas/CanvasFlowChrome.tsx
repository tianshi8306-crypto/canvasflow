import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { Panel, useReactFlow, useStore } from "@xyflow/react";
import type { Node, Edge } from "@xyflow/react";
import { useProjectStore } from "@/store/projectStore";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import "./ZoomMenu.css";
import { CanvasShortcutsOverlay } from "@/components/canvas/CanvasShortcutsOverlay";

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

/** 还原图标 - 逆时针箭头 */
function IconUndo() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 10h10a5 5 0 0 1 5 5v0a5 5 0 0 1-5 5H8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7 6L3 10l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 确认图标 - 勾 */
function IconCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
  const shortcutsOverlayOpen = useCanvasUiStore((s) => s.shortcutsOverlayOpen);
  const setShortcutsOverlayOpen = useCanvasUiStore((s) => s.setShortcutsOverlayOpen);

  const { fitView, getViewport, setViewport, getNodes, setNodes, getEdges, setEdges } = useReactFlow();
  const commitViewport = useProjectStore((s) => s.commitViewport);
  const selectedNodeIds = useProjectStore((s) => s.selectedNodeIds);
  const zoom = useStore((s) => s.transform[2]);
  const [zoomMenuOpen, setZoomMenuOpen] = useState(false);
  const [tidyConfirm, setTidyConfirm] = useState(false); // 整理画布确认状态
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

  // 整理画布
  const tidyCanvas = useCallback(async () => {
    // 保存整理前的状态
    tidyBeforeRef.current = {
      nodes: JSON.parse(JSON.stringify(getNodes())),
      edges: JSON.parse(JSON.stringify(getEdges())),
    };
    try {
      await fitView({ padding: 0.12, duration: 380, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM });
    } catch {
      /* fitView 在极端尺寸下可能失败 */
    }
    commitViewport(getViewport());
    // 显示确认按钮
    setTidyConfirm(true);
  }, [commitViewport, fitView, getNodes, getEdges]);

  // 还原整理前的状态
  const handleTidyUndo = useCallback(() => {
    if (tidyBeforeRef.current) {
      setNodes(tidyBeforeRef.current.nodes);
      setEdges(tidyBeforeRef.current.edges);
      tidyBeforeRef.current = null;
    }
    setTidyConfirm(false);
  }, [setNodes, setEdges]);

  // 保留整理结果
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
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    setMinimapVisible,
    setNodeSnapAlignmentEnabled,
    setShortcutsOverlayOpen,
    shortcutsOverlayOpen,
    tidyCanvas,
    selectedNodeIds,
    fitView,
    getViewport,
    commitViewport,
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
              title="整理画布（适配全部节点）"
              onClick={() => tidyCanvas()}
            >
              <IconTidy />
            </button>
            {tidyConfirm && (
              <div className="tidyConfirmBtns">
                <button
                  type="button"
                  className="tidyConfirmBtn tidyConfirmBtn--undo"
                  title="还原"
                  onClick={handleTidyUndo}
                >
                  <IconUndo />
                </button>
                <button
                  type="button"
                  className="tidyConfirmBtn tidyConfirmBtn--confirm"
                  title="保留"
                  onClick={handleTidyConfirm}
                >
                  <IconCheck />
                </button>
              </div>
            )}
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

      {/* 缩放菜单 - Portal 渲染到 body */}
      {zoomMenuOpen && zoomMenuTriggerRef.current && createPortal(
        <div
          className="zoomMenu"
          style={{
            position: "fixed",
            top: `${zoomMenuTriggerRef.current.getBoundingClientRect().top - 2}px`,
            left: `${zoomMenuTriggerRef.current.getBoundingClientRect().left + zoomMenuTriggerRef.current.getBoundingClientRect().width / 2}px`,
            transform: "translate(-50%, -100%)",
          }}
        >
          <button type="button" className="zoomMenuItem" onClick={() => { applyZoom(zoom + 0.1); setZoomMenuOpen(false); }}>
            放大
          </button>
          <button type="button" className="zoomMenuItem" onClick={() => { applyZoom(zoom - 0.1); setZoomMenuOpen(false); }}>
            缩小
          </button>
          <button type="button" className="zoomMenuItem" onClick={() => { void tidyCanvas(); setZoomMenuOpen(false); }}>
            适合屏幕
          </button>
          <button type="button" className="zoomMenuItem" onClick={() => { applyZoom(0.5); setZoomMenuOpen(false); }}>
            缩放至 50%
          </button>
          <button type="button" className="zoomMenuItem" onClick={() => { applyZoom(1); setZoomMenuOpen(false); }}>
            缩放至 100%
          </button>
          <button type="button" className="zoomMenuItem" onClick={() => { applyZoom(2); setZoomMenuOpen(false); }}>
            缩放至 200%
          </button>
        </div>,
        document.body
      )}
    </>
  );
}
