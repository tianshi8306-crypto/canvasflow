import type { KeyboardEvent, MouseEvent } from "react";
import type { ScriptBeat } from "@/lib/types";
import { SCRIPT_MINI_PREVIEW_MAX_ROWS } from "@/lib/scriptNodeChrome";
import { SCRIPT_MINI_PREVIEW_OPEN_HINT } from "@/lib/scriptNodeCanvasEntries";

type Props = {
  beats: ScriptBeat[];
  themePrompt: string;
  onOpenFullscreen: () => void;
};

/** 脚本节点壳内紧凑镜头表（真源在全屏表格；点击预览或顶栏进全屏） */
export function ScriptNodeMiniPreview({ beats, themePrompt, onOpenFullscreen }: Props) {
  const rows = beats.slice(0, SCRIPT_MINI_PREVIEW_MAX_ROWS);
  const extra = beats.length - rows.length;

  const openFromPreview = (e: MouseEvent | KeyboardEvent) => {
    e.stopPropagation();
    onOpenFullscreen();
  };

  return (
    <div
      className="scriptChrome-previewInner scriptChrome-previewInner--openFullscreen"
      role="button"
      tabIndex={0}
      title={SCRIPT_MINI_PREVIEW_OPEN_HINT}
      aria-label={SCRIPT_MINI_PREVIEW_OPEN_HINT}
      onClick={openFromPreview}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openFromPreview(e);
        }
      }}
    >
      <span className="scriptNodeViewTag">脚本预览</span>
      {themePrompt.trim() ? (
        <p className="scriptChrome-themeSnippet" title={themePrompt}>
          {themePrompt.trim().slice(0, 72)}
          {themePrompt.trim().length > 72 ? "…" : ""}
        </p>
      ) : null}
      <div className="scriptNodeMiniGrid">
        <div className="scriptNodeMiniHead">
          <span>#</span>
          <span>画面</span>
        </div>
        {rows.map((beat, i) => (
          <div key={beat.id} className="scriptNodeMiniRow">
            <span className="scriptNodeMiniIdx">{beat.shotNumber || i + 1}</span>
            <span className="scriptNodeMiniDesc">
              {(beat.description || "—").slice(0, 80)}
            </span>
          </div>
        ))}
      </div>
      {extra > 0 ? (
        <p className="scriptNodeMiniFoot">另有 {extra} 条镜头 · {SCRIPT_MINI_PREVIEW_OPEN_HINT}</p>
      ) : (
        <p className="scriptNodeMiniFoot">{SCRIPT_MINI_PREVIEW_OPEN_HINT}</p>
      )}
    </div>
  );
}
