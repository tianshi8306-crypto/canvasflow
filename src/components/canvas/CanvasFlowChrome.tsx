import { Panel, useReactFlow, useStore } from "@xyflow/react";
import { useCallback, useEffect } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useCanvasUiStore } from "@/store/canvasUiStore";
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

/** 与左侧浮窗小地图语义一致，线框风格对齐 LeftAddDock 图标 */
function IconMinimap() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6.5c0-.83.67-1.5 1.5-1.5h7c.83 0 1.5.67 1.5 1.5V10l3-2v9l-3-2v2.5c0 .83-.67 1.5-1.5 1.5h-7A1.5 1.5 0 0 1 4 17.5v-11Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="10" r="1.35" fill="currentColor" />
    </svg>
  );
}

function IconTidy() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="6" cy="6" r="1.35" stroke="currentColor" strokeWidth="1.35" />
      <circle cx="12" cy="6" r="1.35" stroke="currentColor" strokeWidth="1.35" />
      <circle cx="18" cy="6" r="1.35" stroke="currentColor" strokeWidth="1.35" />
      <circle cx="6" cy="12" r="1.35" stroke="currentColor" strokeWidth="1.35" />
      <circle cx="12" cy="12" r="1.35" stroke="currentColor" strokeWidth="1.35" />
      <circle cx="18" cy="12" r="1.35" stroke="currentColor" strokeWidth="1.35" />
      <circle cx="6" cy="18" r="1.35" stroke="currentColor" strokeWidth="1.35" />
      <circle cx="12" cy="18" r="1.35" stroke="currentColor" strokeWidth="1.35" />
      <circle cx="18" cy="18" r="1.35" stroke="currentColor" strokeWidth="1.35" />
    </svg>
  );
}

function IconSnap() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 5h4M15 5h4M5 19h4M15 19h4M5 5v4M19 5v4M5 19v-4M19 19v-4"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    </svg>
  );
}

/** 与 LeftAddDock 侧栏「帮助」占位图标一致 */
function IconHelp() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M12 16v.01M10.5 10a1.5 1.5 0 1 1 3 0c0 1.5-1.5 1.2-1.5 2.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
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

  const { fitView, getViewport, setViewport } = useReactFlow();
  const commitViewport = useProjectStore((s) => s.commitViewport);
  const zoom = useStore((s) => s.transform[2]);

  const tidyCanvas = useCallback(async () => {
    try {
      await fitView({ padding: 0.12, duration: 380, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM });
    } catch {
      /* fitView 在极端尺寸下可能失败 */
    }
    commitViewport(getViewport());
  }, [commitViewport, fitView, getViewport]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (shortcutsOverlayOpen && e.key === "Escape") {
        e.preventDefault();
        setShortcutsOverlayOpen(false);
        return;
      }
      if (isEditingTextField(e.target)) return;

      if (e.altKey && e.shiftKey && e.key.toLowerCase() === "f") {
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
  ]);

  const slider01 = Math.min(1, Math.max(0, (zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)));

  const onZoomInput = (next01: number) => {
    const z = MIN_ZOOM + next01 * (MAX_ZOOM - MIN_ZOOM);
    const vp = getViewport();
    void setViewport({ ...vp, zoom: z }, { duration: 0 });
  };

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
              onClick={() => void tidyCanvas()}
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
              <input
                className="canvasBottomDockZoomInput"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={slider01}
                aria-label="画布缩放"
                style={{
                  background: `linear-gradient(to right, var(--text) 0%, var(--text) ${slider01 * 100}%, rgba(71, 85, 105, 0.55) ${slider01 * 100}%, rgba(71, 85, 105, 0.55) 100%)`,
                }}
                onChange={(ev) => onZoomInput(Number(ev.target.value))}
                onPointerUp={() => commitViewport(getViewport())}
                onPointerCancel={() => commitViewport(getViewport())}
              />
            </div>
            <div className="canvasBottomDockDivider" aria-hidden />
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
    </>
  );
}
