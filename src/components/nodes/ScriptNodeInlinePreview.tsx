import { useRef, type PointerEvent, type WheelEvent } from "react";
import type { ScriptBeat } from "@/lib/types";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";
import { ScriptBeatsEditorTable } from "@/components/ScriptBeatsEditorTable";
import { openScriptNodeFullscreen } from "@/lib/scriptNodeCanvasEntries";

type Props = {
  nodeId: string;
  label: string;
  beats: ScriptBeat[];
  projectPath: string | null;
  readOnly?: boolean;
  onPersistRows: (next: ScriptBeat[]) => void;
  onStatusText: (msg: string) => void;
};

/** 画布节点壳内：基本镜头表（9 列，编号 1/2/3） */
export function ScriptNodeInlinePreview({
  nodeId,
  label,
  beats,
  projectPath,
  readOnly = false,
  onPersistRows,
  onStatusText,
}: Props) {
  const inlineTableDragRef = useRef({
    active: false,
    startX: 0,
    startScrollLeft: 0,
  });
  const inlineTableWrapRef = useRef<HTMLDivElement | null>(null);
  const displayTitle = (label || "分镜脚本").trim();

  const onInlineTablePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        "input, textarea, select, button, a, label, [contenteditable='true'], [contenteditable='plaintext-only']",
      )
    ) {
      return;
    }
    inlineTableDragRef.current = {
      active: true,
      startX: e.clientX,
      startScrollLeft: e.currentTarget.scrollLeft,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  };

  const onInlineTablePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!inlineTableDragRef.current.active) return;
    const dx = e.clientX - inlineTableDragRef.current.startX;
    e.currentTarget.scrollLeft = inlineTableDragRef.current.startScrollLeft - dx;
    e.preventDefault();
    e.stopPropagation();
  };

  const onInlineTablePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    inlineTableDragRef.current.active = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    e.stopPropagation();
  };

  const onInlineTableWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (!e.shiftKey) {
      e.stopPropagation();
      return;
    }
    e.currentTarget.scrollLeft += e.deltaY;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="scriptChrome-previewInner scriptChrome-inlinePreview">
      <div className="scriptChrome-inlineHead scriptLibFullscreenTitleRow">
        <div className="scriptLibFullscreenTitle mono" title={displayTitle}>
          {displayTitle}
        </div>
        <div className="scriptLibFullscreenHeadRight">
          <span className="scriptLibViewBadge">脚本视图</span>
          <button
            type="button"
            className="scriptNodeExpandBtn scriptNodeExpandBtn--inHead scriptChrome-inlineExpandBtn"
            title="展开全屏"
            aria-label="展开全屏"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              openScriptNodeFullscreen(nodeId);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M15 3h6v6M9 21H3v-6M21 9v6h-6M3 15V9h6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
      <div
        className={`scriptTableWrap scriptNodeInlineTableWrap ${RF_NODE_INPUT_CLASS} nowheel nopan`}
        ref={inlineTableWrapRef}
        onPointerDown={onInlineTablePointerDown}
        onPointerMove={onInlineTablePointerMove}
        onPointerUp={onInlineTablePointerUp}
        onPointerCancel={onInlineTablePointerUp}
        onWheel={onInlineTableWheel}
      >
        <ScriptBeatsEditorTable
          variant="inline"
          tableMode="basic"
          inlineDescRows={4}
          readOnly={readOnly}
          rows={beats}
          onPersistRows={onPersistRows}
          projectPath={projectPath}
          onStatusText={onStatusText}
        />
      </div>
    </div>
  );
}
