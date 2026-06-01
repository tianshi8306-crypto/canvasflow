import { useCallback, useMemo, useRef, useState } from "react";
import { ComposeTimelineClipView } from "@/components/compose/ComposeTimelineClipView";
import {
  ComposeTimelineContextMenu,
  type ComposeContextMenuAction,
} from "@/components/compose/ComposeTimelineContextMenu";
import { IconVideoTrack } from "@/components/compose/composeEditorIcons";
import type { ComposeTimelineClip } from "@/lib/compose";
import { formatDurationSec } from "@/lib/compose/formatDuration";
import { resolveSecFromTrackX, type TimelineSegment } from "@/lib/compose/timelineLayout";

const CLIP_GAP = 0;

type Props = {
  segments: TimelineSegment[];
  timelineClips: ComposeTimelineClip[];
  totalSec: number;
  totalWidthPx: number;
  selectedIndex: number;
  playheadSec: number;
  scrollHostRef?: React.Ref<HTMLDivElement>;
  canSplit: boolean;
  canTrimIn: boolean;
  canTrimOut: boolean;
  canLocate: boolean;
  onSelect: (index: number) => void;
  onReorder: (from: number, to: number) => void;
  onDuration: (relPath: string, sec: number) => void;
  onSeek: (sec: number) => void;
  onContextAction: (index: number, action: ComposeContextMenuAction) => void;
  onTrimDragStart: (index: number, edge: "in" | "out") => void;
  onTrimDrag: (trackPx: number) => void;
  onTrimDragEnd: () => void;
};

function rulerTicks(totalSec: number): number[] {
  if (totalSec <= 0) return [0];
  let step = 1;
  if (totalSec > 120) step = 30;
  else if (totalSec > 60) step = 10;
  else if (totalSec > 20) step = 5;
  const ticks: number[] = [];
  for (let t = 0; t <= totalSec + 0.01; t += step) {
    ticks.push(t);
  }
  return ticks;
}

type MenuState = { index: number; x: number; y: number };

export function ComposeTimelineTrack({
  segments,
  timelineClips,
  totalSec,
  totalWidthPx,
  selectedIndex,
  playheadSec,
  scrollHostRef,
  canSplit,
  canTrimIn,
  canTrimOut,
  canLocate,
  onSelect,
  onReorder,
  onDuration,
  onSeek,
  onContextAction,
  onTrimDragStart,
  onTrimDrag,
  onTrimDragEnd,
}: Props) {
  const dragIndexRef = useRef<number | null>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const scrubbingRef = useRef(false);
  const [menu, setMenu] = useState<MenuState | null>(null);

  const trackXFromEvent = useCallback((e: React.PointerEvent | PointerEvent) => {
    const el = innerRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return e.clientX - rect.left + el.scrollLeft;
  }, []);

  const playheadLeftPx = useMemo(() => {
    if (totalSec <= 0) return 0;
    return Math.min(totalWidthPx, (playheadSec / totalSec) * totalWidthPx);
  }, [playheadSec, totalSec, totalWidthPx]);

  const ticks = useMemo(() => rulerTicks(totalSec), [totalSec]);

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const el = innerRef.current;
      if (!el || segments.length === 0) return;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left + el.scrollLeft;
      onSeek(resolveSecFromTrackX(segments, x, CLIP_GAP));
    },
    [segments, onSeek],
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest(".composeTimelineClip")) return;
    if ((e.target as HTMLElement).closest(".composeTimelineTrimHandle")) return;
    setMenu(null);
    scrubbingRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    seekFromClientX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!scrubbingRef.current) return;
    seekFromClientX(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!scrubbingRef.current) return;
    scrubbingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const openClipMenu = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(index);
    setMenu({ index, x: e.clientX, y: e.clientY });
  };

  if (segments.length === 0) {
    return (
      <div className="composeTimelineEmpty">
        从上游连接视频节点后，点击工具栏刷新图标收集片段
      </div>
    );
  }

  const contentWidth = Math.max(totalWidthPx, 320);

  return (
    <div className="composeTimelineSection">
      <div className="composeTimelineTrackLabelCol" aria-hidden>
        <div className="composeTimelineTrackLabelIcon" title="视频轨 V1">
          <IconVideoTrack size={16} />
        </div>
      </div>

      <div
        ref={scrollHostRef}
        className="composeTimelineScroll"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div ref={innerRef} className="composeTimelineScrollInner" style={{ width: contentWidth }}>
          <div className="composeTimelineRuler">
            {ticks.map((t) => (
              <span
                key={t}
                className="composeTimelineRulerTick"
                style={{ left: totalSec > 0 ? `${(t / totalSec) * 100}%` : 0 }}
              >
                <span className="composeTimelineRulerMark" aria-hidden />
                {formatDurationSec(t)}
              </span>
            ))}
            <div
              className="composeTimelinePlayhead composeTimelinePlayhead--ruler"
              style={{ left: playheadLeftPx }}
            >
              <span className="composeTimelinePlayheadKnob" />
            </div>
          </div>

          <div className="composeTimelineTrackLane">
            <div
              className="composeTimelinePlayhead composeTimelinePlayhead--track"
              style={{ left: playheadLeftPx }}
              aria-hidden
            />
            <div className="composeTimelineClips">
              {segments.map((seg) => {
                const selected = seg.index === selectedIndex;
                const clip = timelineClips[seg.index];
                return (
                  <ComposeTimelineClipView
                    key={seg.clipId}
                    seg={seg}
                    clip={clip}
                    selected={selected}
                    allowReorder={!selected}
                    onSelect={() => onSelect(seg.index)}
                    onContextMenu={(e) => openClipMenu(seg.index, e)}
                    onReorderDragStart={() => {
                      dragIndexRef.current = seg.index;
                    }}
                    onDropTarget={() => {
                      const from = dragIndexRef.current;
                      if (from == null || from === seg.index) return;
                      onReorder(from, seg.index);
                      dragIndexRef.current = null;
                    }}
                    onDuration={onDuration}
                    onTrimDragStart={(edge) => onTrimDragStart(seg.index, edge)}
                    onTrimDrag={onTrimDrag}
                    onTrimDragEnd={onTrimDragEnd}
                    trackXFromEvent={trackXFromEvent}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {menu ? (
        <ComposeTimelineContextMenu
          x={menu.x}
          y={menu.y}
          canSplit={canSplit}
          canTrimIn={canTrimIn}
          canTrimOut={canTrimOut}
          canLocate={canLocate && Boolean(timelineClips[menu.index]?.sourceNodeId)}
          canDelete
          onClose={() => setMenu(null)}
          onAction={(action) => {
            onContextAction(menu.index, action);
            setMenu(null);
          }}
        />
      ) : null}
    </div>
  );
}
