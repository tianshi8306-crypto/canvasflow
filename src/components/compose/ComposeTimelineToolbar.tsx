import { useRef, useState } from "react";
import { formatDurationSec } from "@/lib/compose/formatDuration";
import {
  IconDelete,
  IconFit,
  IconLocate,
  IconMore,
  IconPause,
  IconPlay,
  IconRedo,
  IconRefresh,
  IconSequence,
  IconSplit,
  IconTrimIn,
  IconTrimOut,
  IconUndo,
  IconZoomIn,
  IconZoomOut,
} from "@/components/compose/composeEditorIcons";

type Props = {
  playing: boolean;
  playheadSec: number;
  totalSec: number;
  clipCount: number;
  selectedIndex: number;
  timelineZoom: number;
  canPlay: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canSplit: boolean;
  canTrimIn: boolean;
  canTrimOut: boolean;
  canDelete: boolean;
  canLocate: boolean;
  refreshing: boolean;
  running: boolean;
  sequencePlaying: boolean;
  canSequence: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSplit: () => void;
  onTrimIn: () => void;
  onTrimOut: () => void;
  onTogglePlay: () => void;
  onToggleSequence: () => void;
  onDelete: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  onLocate: () => void;
  onRefresh: () => void;
  onFillFromScript: () => void;
  canFillFromScript: boolean;
  onSortScript: () => void;
  onClear: () => void;
  onZoomChange: (v: number) => void;
  timelineSnapEnabled: boolean;
  onToggleTimelineSnap: () => void;
};

export function ComposeTimelineToolbar({
  playing,
  playheadSec,
  totalSec,
  clipCount,
  selectedIndex,
  timelineZoom,
  canPlay,
  canUndo,
  canRedo,
  canSplit,
  canTrimIn,
  canTrimOut,
  canDelete,
  canLocate,
  refreshing,
  running,
  sequencePlaying,
  canSequence,
  onUndo,
  onRedo,
  onSplit,
  onTrimIn,
  onTrimOut,
  onTogglePlay,
  onToggleSequence,
  onDelete,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  onLocate,
  onRefresh,
  onFillFromScript,
  canFillFromScript,
  onSortScript,
  onClear,
  onZoomChange,
  timelineSnapEnabled,
  onToggleTimelineSnap,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  return (
    <div className="composeTimelineToolbar">
      <div className="composeTimelineToolbarGroup composeTimelineToolbarGroup--left">
        <button
          type="button"
          className="composeTimelineIconBtn"
          title="撤销 (Ctrl+Z)"
          disabled={!canUndo}
          onClick={onUndo}
        >
          <IconUndo />
        </button>
        <button
          type="button"
          className="composeTimelineIconBtn"
          title="重做 (Ctrl+Shift+Z)"
          disabled={!canRedo}
          onClick={onRedo}
        >
          <IconRedo />
        </button>
        <span className="composeTimelineToolbarDivider" aria-hidden />
        <button
          type="button"
          className="composeTimelineIconBtn"
          title="在播放头分割 (S)"
          disabled={!canSplit}
          onClick={onSplit}
        >
          <IconSplit />
        </button>
        <button
          type="button"
          className="composeTimelineIconBtn"
          title="修剪入点 — 裁掉播放头左侧"
          disabled={!canTrimIn}
          onClick={onTrimIn}
        >
          <IconTrimIn />
        </button>
        <button
          type="button"
          className="composeTimelineIconBtn"
          title="修剪出点 — 裁掉播放头右侧"
          disabled={!canTrimOut}
          onClick={onTrimOut}
        >
          <IconTrimOut />
        </button>
        <button
          type="button"
          className="composeTimelineIconBtn composeTimelineIconBtn--danger"
          title="删除选中片段 (Del)"
          disabled={!canDelete}
          onClick={onDelete}
        >
          <IconDelete />
        </button>
        <span className="composeTimelineToolbarDivider" aria-hidden />
        <button
          type="button"
          className="composeTimelineIconBtn"
          title="从连线刷新"
          disabled={refreshing || running}
          onClick={onRefresh}
        >
          <IconRefresh />
        </button>
        <div className="composeTimelineMenuWrap" ref={menuRef}>
          <button
            type="button"
            className="composeTimelineIconBtn"
            title="更多"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <IconMore />
          </button>
          {menuOpen ? (
            <>
              <div
                className="composeTimelineMenuBackdrop"
                role="presentation"
                onClick={() => setMenuOpen(false)}
              />
              <div className="composeTimelineMenu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  disabled={refreshing || !canFillFromScript}
                  onClick={() => {
                    setMenuOpen(false);
                    onFillFromScript();
                  }}
                >
                  从脚本镜头填充
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={refreshing}
                  onClick={() => {
                    setMenuOpen(false);
                    onSortScript();
                  }}
                >
                  按脚本镜号排序
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={!canLocate}
                  onClick={() => {
                    setMenuOpen(false);
                    onLocate();
                  }}
                >
                  定位源节点
                </button>
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={timelineSnapEnabled}
                  className={timelineSnapEnabled ? "composeTimelineMenuItem--active" : undefined}
                  onClick={() => {
                    onToggleTimelineSnap();
                  }}
                >
                  磁性吸附 {timelineSnapEnabled ? "开" : "关"}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={clipCount === 0}
                  onClick={() => {
                    setMenuOpen(false);
                    onClear();
                  }}
                >
                  清空时间线
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="composeTimelineToolbarGroup composeTimelineToolbarGroup--center">
        <span className="composeTimelineTime">
          {formatDurationSec(playheadSec)} / {formatDurationSec(totalSec)}
        </span>
        <button
          type="button"
          className="composeTimelinePlayBtn"
          title={playing ? "暂停 (空格)" : "播放 (空格)"}
          disabled={!canPlay}
          onClick={onTogglePlay}
        >
          {playing ? <IconPause size={20} /> : <IconPlay size={20} />}
        </button>
        {canSequence ? (
          <button
            type="button"
            className={`composeTimelineIconBtn${sequencePlaying ? " composeTimelineIconBtn--active" : ""}`}
            title={sequencePlaying ? "停止顺序连播" : "顺序连播"}
            onClick={onToggleSequence}
          >
            <IconSequence />
          </button>
        ) : null}
        {clipCount > 0 ? (
          <span className="composeTimelineClipHint">
            片段 {selectedIndex + 1}/{clipCount}
          </span>
        ) : null}
      </div>

      <div className="composeTimelineToolbarGroup composeTimelineToolbarGroup--right">
        <button type="button" className="composeTimelineIconBtn" title="缩小" onClick={onZoomOut}>
          <IconZoomOut />
        </button>
        <input
          type="range"
          className="composeTimelineZoomSlider"
          min={0.5}
          max={2.5}
          step={0.1}
          value={timelineZoom}
          onChange={(e) => onZoomChange(Number(e.target.value))}
          aria-label="时间线缩放"
        />
        <button type="button" className="composeTimelineIconBtn" title="放大" onClick={onZoomIn}>
          <IconZoomIn />
        </button>
        <button type="button" className="composeTimelineIconBtn" title="适应窗口" onClick={onZoomFit}>
          <IconFit />
        </button>
        <button
          type="button"
          className="composeTimelineIconBtn"
          title="定位源节点"
          disabled={!canLocate}
          onClick={onLocate}
        >
          <IconLocate />
        </button>
      </div>
    </div>
  );
}
