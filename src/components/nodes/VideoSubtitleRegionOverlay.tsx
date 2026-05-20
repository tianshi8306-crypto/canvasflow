import { useCallback, useEffect, useRef, useState } from "react";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";
import {
  contentPxToNormalizedRegion,
  getVideoContentRect,
  normalizedRegionToContentPx,
  type PxRect,
} from "@/lib/videoPreviewGeometry";
import {
  normalizeVideoSubtitleRegion,
} from "@/lib/videoSubtitleRegion";
import type { VideoSubtitleRegion } from "@/lib/videoNodeTypes";

type DragMode = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

type Props = {
  containerRef: React.RefObject<HTMLElement | null>;
  intrinsicWidth: number;
  intrinsicHeight: number;
  region: VideoSubtitleRegion;
  onRegionChange: (region: VideoSubtitleRegion) => void;
  onCancel: () => void;
  onApply: () => void;
  busy?: boolean;
};

function clampBoxToContent(box: PxRect, content: PxRect, minW: number, minH: number): PxRect {
  const w = Math.max(minW, Math.min(box.width, content.width));
  const h = Math.max(minH, Math.min(box.height, content.height));
  let left = box.left;
  let top = box.top;
  if (left < content.left) left = content.left;
  if (top < content.top) top = content.top;
  if (left + w > content.left + content.width) left = content.left + content.width - w;
  if (top + h > content.top + content.height) top = content.top + content.height - h;
  return { left, top, width: w, height: h };
}

export function VideoSubtitleRegionOverlay({
  containerRef,
  intrinsicWidth,
  intrinsicHeight,
  region,
  onRegionChange,
  onCancel,
  onApply,
  busy = false,
}: Props) {
  const dragRef = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    startBox: PxRect;
    content: PxRect;
  } | null>(null);
  const [layoutTick, setLayoutTick] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setLayoutTick((t) => t + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

  const measure = useCallback((): { container: DOMRect; content: PxRect } | null => {
    const el = containerRef.current;
    if (!el || intrinsicWidth <= 0 || intrinsicHeight <= 0) return null;
    const container = el.getBoundingClientRect();
    const content = getVideoContentRect(
      container.width,
      container.height,
      intrinsicWidth,
      intrinsicHeight,
    );
    return { container, content };
  }, [containerRef, intrinsicHeight, intrinsicWidth, layoutTick]);

  const selectionPx = (() => {
    const m = measure();
    if (!m) return null;
    return normalizedRegionToContentPx(region, m.content);
  })();

  const beginDrag = useCallback(
    (mode: DragMode, ev: React.PointerEvent) => {
      if (busy) return;
      const m = measure();
      if (!m || !selectionPx) return;
      ev.preventDefault();
      ev.stopPropagation();
      ev.currentTarget.setPointerCapture(ev.pointerId);
      dragRef.current = {
        mode,
        startX: ev.clientX,
        startY: ev.clientY,
        startBox: { ...selectionPx },
        content: m.content,
      };
    },
    [busy, measure, selectionPx],
  );

  const onPointerMove = useCallback(
    (ev: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d || !ev.currentTarget.hasPointerCapture(ev.pointerId)) return;
      ev.preventDefault();
      ev.stopPropagation();

      const dx = ev.clientX - d.startX;
      const dy = ev.clientY - d.startY;
      const minW = d.content.width * 0.05;
      const minH = d.content.height * 0.03;
      let box = { ...d.startBox };

      if (d.mode === "move") {
        box.left += dx;
        box.top += dy;
        box = clampBoxToContent(box, d.content, minW, minH);
      } else {
        let left = d.startBox.left;
        let top = d.startBox.top;
        let right = d.startBox.left + d.startBox.width;
        let bottom = d.startBox.top + d.startBox.height;
        if (d.mode.includes("w")) left += dx;
        if (d.mode.includes("e")) right += dx;
        if (d.mode.includes("n")) top += dy;
        if (d.mode.includes("s")) bottom += dy;
        box = {
          left,
          top,
          width: right - left,
          height: bottom - top,
        };
        box = clampBoxToContent(box, d.content, minW, minH);
      }

      onRegionChange(normalizeVideoSubtitleRegion(contentPxToNormalizedRegion(box, d.content)));
    },
    [onRegionChange],
  );

  const endDrag = useCallback((ev: React.PointerEvent) => {
    if (ev.currentTarget.hasPointerCapture(ev.pointerId)) {
      ev.currentTarget.releasePointerCapture(ev.pointerId);
    }
    dragRef.current = null;
  }, []);

  if (!selectionPx) return null;

  const m = measure();
  if (!m) return null;
  const sel = selectionPx;
  const containerW = m.container.width;
  const containerH = m.container.height;

  const dims = [
    { key: "top", style: { left: 0, top: 0, width: containerW, height: sel.top } },
    {
      key: "bottom",
      style: { left: 0, top: sel.top + sel.height, width: containerW, height: containerH - sel.top - sel.height },
    },
    {
      key: "left",
      style: { left: 0, top: sel.top, width: sel.left, height: sel.height },
    },
    {
      key: "right",
      style: {
        left: sel.left + sel.width,
        top: sel.top,
        width: containerW - sel.left - sel.width,
        height: sel.height,
      },
    },
  ];

  const handles: { mode: DragMode; className: string; style: React.CSSProperties }[] = [
    { mode: "nw", className: "vidSubtitleRegion-handle vidSubtitleRegion-handle--nw", style: { left: sel.left, top: sel.top } },
    { mode: "ne", className: "vidSubtitleRegion-handle vidSubtitleRegion-handle--ne", style: { left: sel.left + sel.width, top: sel.top } },
    { mode: "sw", className: "vidSubtitleRegion-handle vidSubtitleRegion-handle--sw", style: { left: sel.left, top: sel.top + sel.height } },
    { mode: "se", className: "vidSubtitleRegion-handle vidSubtitleRegion-handle--se", style: { left: sel.left + sel.width, top: sel.top + sel.height } },
    { mode: "n", className: "vidSubtitleRegion-handle vidSubtitleRegion-handle--n", style: { left: sel.left + sel.width / 2, top: sel.top } },
    { mode: "s", className: "vidSubtitleRegion-handle vidSubtitleRegion-handle--s", style: { left: sel.left + sel.width / 2, top: sel.top + sel.height } },
    { mode: "w", className: "vidSubtitleRegion-handle vidSubtitleRegion-handle--w", style: { left: sel.left, top: sel.top + sel.height / 2 } },
    { mode: "e", className: "vidSubtitleRegion-handle vidSubtitleRegion-handle--e", style: { left: sel.left + sel.width, top: sel.top + sel.height / 2 } },
  ];

  return (
    <div
      className={`vidSubtitleRegionOverlay ${RF_NODE_INPUT_CLASS}`}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div
        className={`vidSubtitleRegionBar ${RF_NODE_INPUT_CLASS}`}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <span className="vidSubtitleRegionBar-label">
          {busy ? "正在去字幕…" : "框选字幕区域（固定条带硬字幕）"}
        </span>
        <div className="vidSubtitleRegionBar-actions">
          <button
            type="button"
            className="vidSubtitleRegionBar-btn"
            disabled={busy}
            onClick={onApply}
          >
            应用去字幕
          </button>
          <button
            type="button"
            className="vidSubtitleRegionBar-btn vidSubtitleRegionBar-btn--ghost"
            disabled={busy}
            onClick={onCancel}
          >
            取消
          </button>
        </div>
      </div>

      {dims.map((d) => (
        <div key={d.key} className="vidSubtitleRegion-dim" style={d.style} aria-hidden />
      ))}

      <div
        className="vidSubtitleRegion-box"
        style={{
          left: sel.left,
          top: sel.top,
          width: sel.width,
          height: sel.height,
        }}
        onPointerDown={(e) => beginDrag("move", e)}
      />

      {handles.map((h) => (
        <div
          key={h.mode}
          className={h.className}
          style={h.style}
          onPointerDown={(e) => beginDrag(h.mode, e)}
        />
      ))}
    </div>
  );
}
