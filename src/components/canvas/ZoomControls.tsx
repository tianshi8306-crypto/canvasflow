import { useCallback, useEffect, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 3.0;
const ZOOM_STEP = 0.1;
const LONG_PRESS_DELAY = 500;
const LONG_PRESS_INTERVAL = 150;

function calcZoomPercent(zoom: number): number {
  return Math.round(zoom * 100);
}

function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

interface MenuOption {
  label: string;
  action: () => void;
  disabled?: boolean;
}

export function ZoomControls() {
  const { setViewport, getViewport, getNodes } = useReactFlow();
  const [zoomPercent, setZoomPercent] = useState(() => calcZoomPercent(getViewport().zoom));
  const [menuOpen, setMenuOpen] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // 同步当前缩放比例
  useEffect(() => {
    const interval = setInterval(() => {
      const z = calcZoomPercent(getViewport().zoom);
      setZoomPercent((prev) => (prev !== z ? z : prev));
    }, 200);
    return () => clearInterval(interval);
  }, [getViewport]);

  // 点击外部关闭菜单
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const doZoom = useCallback(
    (delta: number) => {
      const cur = getViewport();
      const newZoom = clampZoom(cur.zoom + delta);
      setViewport({ ...cur, zoom: newZoom });
      setZoomPercent(calcZoomPercent(newZoom));
    },
    [getViewport, setViewport],
  );

  const zoomIn = useCallback(() => doZoom(ZOOM_STEP), [doZoom]);
  const zoomOut = useCallback(() => doZoom(-ZOOM_STEP), [doZoom]);

  const startLongPress = useCallback(
    (action: () => void) => {
      action();
      longPressTimerRef.current = setTimeout(() => {
        longPressIntervalRef.current = setInterval(() => {
          action();
        }, LONG_PRESS_INTERVAL);
      }, LONG_PRESS_DELAY);
    },
    [],
  );

  const stopLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (longPressIntervalRef.current) {
      clearInterval(longPressIntervalRef.current);
      longPressIntervalRef.current = null;
    }
  }, []);

  const handleFit = useCallback(() => {
    const nodes = getNodes();
    if (nodes.length === 0) {
      const cur = getViewport();
      setViewport({ x: 0, y: 0, zoom: 1 });
      setZoomPercent(100);
      return;
    }

    const padding = 80;
    const vp = getViewport();
    const container = document.querySelector(".react-flow__viewport")?.parentElement;
    if (!container) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      const w = (n.measured?.width ?? n.width ?? 200) as number;
      const h = (n.measured?.height ?? n.height ?? 100) as number;
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + w);
      maxY = Math.max(maxY, n.position.y + h);
    }

    const contentW = maxX - minX + padding * 2;
    const contentH = maxY - minY + padding * 2;
    const scaleX = cw / contentW;
    const scaleY = ch / contentH;
    const newZoom = clampZoom(Math.min(scaleX, scaleY));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const newX = cw / 2 - centerX * newZoom;
    const newY = ch / 2 - centerY * newZoom;

    setViewport({ x: newX, y: newY, zoom: newZoom });
    setZoomPercent(calcZoomPercent(newZoom));
  }, [getNodes, getViewport, setViewport]);

  const setZoom = useCallback(
    (zoom: number) => {
      const cur = getViewport();
      const newZoom = clampZoom(zoom);
      setViewport({ ...cur, zoom: newZoom });
      setZoomPercent(calcZoomPercent(newZoom));
    },
    [getViewport, setViewport],
  );

  const menuOptions: MenuOption[] = [
    { label: "放大", action: zoomIn },
    { label: "缩小", action: zoomOut },
    { label: "适合屏幕", action: handleFit },
    { label: "缩放至 50%", action: () => setZoom(0.5) },
    { label: "缩放至 100%", action: () => setZoom(1.0) },
    { label: "缩放至 200%", action: () => setZoom(2.0) },
  ];

  const atMin = getViewport().zoom <= MIN_ZOOM;
  const atMax = getViewport().zoom >= MAX_ZOOM;

  return (
    <div className="zoomControls" ref={menuRef}>
        <button
          className="zoomBtn"
          title="缩小（长按连续缩小）"
          onClick={zoomOut}
          onMouseDown={() => startLongPress(zoomOut)}
          onMouseUp={stopLongPress}
          onMouseLeave={stopLongPress}
          onTouchStart={() => startLongPress(zoomOut)}
          onTouchEnd={stopLongPress}
          disabled={atMin}
        >
          −
        </button>

        <button
          className="zoomPercentBtn"
          title="缩放选项"
          onClick={() => setMenuOpen((o) => !o)}
        >
          {zoomPercent}%
          <span className="zoomCaret">▼</span>
        </button>

        <button
          className="zoomBtn"
          title="放大（长按连续放大）"
          onClick={zoomIn}
          onMouseDown={() => startLongPress(zoomIn)}
          onMouseUp={stopLongPress}
          onMouseLeave={stopLongPress}
          onTouchStart={() => startLongPress(zoomIn)}
          onTouchEnd={stopLongPress}
          disabled={atMax}
        >
          +
        </button>

        {menuOpen && (
          <div className="zoomMenu">
            {menuOptions.map((opt) => (
              <button
                key={opt.label}
                className="zoomMenuItem"
                onClick={() => {
                  opt.action();
                  setMenuOpen(false);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
  );
}
