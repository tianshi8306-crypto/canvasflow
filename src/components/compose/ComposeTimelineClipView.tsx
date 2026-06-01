import { ComposeClipDurationProbe } from "@/components/compose/ComposeClipDurationProbe";
import { ComposeClipFilmstrip } from "@/components/compose/ComposeClipFilmstrip";
import { clipDisplayLabel, type ComposeTimelineClip } from "@/lib/compose";
import { formatDurationSec } from "@/lib/compose/formatDuration";
import type { TimelineSegment } from "@/lib/compose/timelineLayout";

type Props = {
  seg: TimelineSegment;
  clip: ComposeTimelineClip | undefined;
  selected: boolean;
  allowReorder: boolean;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onReorderDragStart: () => void;
  onDropTarget: () => void;
  onDuration: (relPath: string, sec: number) => void;
  onTrimDragStart: (edge: "in" | "out") => void;
  onTrimDrag: (trackPx: number) => void;
  onTrimDragEnd: () => void;
  trackXFromEvent: (e: React.PointerEvent | PointerEvent) => number;
};

export function ComposeTimelineClipView({
  seg,
  clip,
  selected,
  allowReorder,
  onSelect,
  onContextMenu,
  onReorderDragStart,
  onDropTarget,
  onDuration,
  onTrimDragStart,
  onTrimDrag,
  onTrimDragEnd,
  trackXFromEvent,
}: Props) {
  const label = clip ? clipDisplayLabel(clip) : seg.path;

  const startTrimDrag = (edge: "in" | "out", e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onTrimDragStart(edge);
    onTrimDrag(trackXFromEvent(e));
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      onTrimDrag(trackXFromEvent(ev));
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      onTrimDragEnd();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      className={`composeTimelineClip${selected ? " composeTimelineClip--selected" : ""}${selected ? " composeTimelineClip--trimming" : ""}`}
      style={{ width: seg.widthPx }}
      draggable={allowReorder}
      onDragStart={(e) => {
        if (!allowReorder) {
          e.preventDefault();
          return;
        }
        onReorderDragStart();
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDropTarget();
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onContextMenu={onContextMenu}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {selected ? (
        <>
          <div
            className="composeTimelineTrimHandle composeTimelineTrimHandle--in"
            title="拖拽修剪入点"
            onPointerDown={(e) => startTrimDrag("in", e)}
          />
          <div
            className="composeTimelineTrimHandle composeTimelineTrimHandle--out"
            title="拖拽修剪出点"
            onPointerDown={(e) => startTrimDrag("out", e)}
          />
        </>
      ) : null}
      <div className="composeTimelineClipBadge">
        <span className="composeTimelineClipBadgeLabel" title={label}>
          {label}
        </span>
        <span className="composeTimelineClipBadgeDur">{formatDurationSec(seg.durationSec)}</span>
      </div>
      <ComposeClipFilmstrip
        relPath={seg.path}
        inSec={seg.inSec}
        durationSec={seg.durationSec}
        widthPx={seg.widthPx}
      />
      <ComposeClipDurationProbe relPath={seg.path} onDuration={onDuration} />
      {selected ? <span className="composeTimelineClipSelectionBar" aria-hidden /> : null}
    </div>
  );
}
