import { useCallback } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { downloadProjectAudioWithDialog } from "@/lib/audioPreviewToolbarActions";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";
import {
  formatPlaybackRateLabel,
  nextPlaybackRate,
} from "@/components/nodes/MinimalAudioWavePlayer";
import { DESKTOP_SHELL_HINT } from "@/lib/tauriEnv";
import { useResolvedAssetRelPath } from "@/hooks/useResolvedAssetRelPath";
import { useProjectStore } from "@/store/projectStore";

type Props = {
  hasLocalAudio: boolean;
  mediaPath?: string;
  mediaAssetId?: string;
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
};

function IconDownload() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AudioPreviewToolbar({
  hasLocalAudio,
  mediaPath,
  mediaAssetId,
  playbackRate,
  onPlaybackRateChange,
}: Props) {
  const projectPath = useProjectStore((s) => s.projectPath);
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const { effectiveRelPath, loading: pathLoading } = useResolvedAssetRelPath(
    mediaPath,
    mediaAssetId,
  );

  const onDownload = useCallback(() => {
    if (!isTauri()) {
      setStatusText(DESKTOP_SHELL_HINT);
      return;
    }
    if (!projectPath?.trim()) {
      setStatusText("请先打开工程");
      return;
    }
    if (pathLoading) {
      setStatusText("正在解析音频路径…");
      return;
    }
    const rel = effectiveRelPath?.trim();
    if (!rel) {
      setStatusText("无法解析音频文件路径");
      return;
    }
    const fileName = rel.split(/[/\\]/).pop() ?? "audio.mp3";
    void downloadProjectAudioWithDialog(projectPath, rel, fileName)
      .then((ok) => setStatusText(ok ? `已保存：${fileName}` : "已取消下载"))
      .catch((e) => setStatusText(`下载失败：${e instanceof Error ? e.message : String(e)}`));
  }, [effectiveRelPath, pathLoading, projectPath, setStatusText]);

  const onCycleRate = useCallback(() => {
    const next = nextPlaybackRate(playbackRate);
    onPlaybackRateChange(next);
    setStatusText(`播放倍速：${formatPlaybackRateLabel(next)}`);
  }, [onPlaybackRateChange, playbackRate, setStatusText]);

  if (!hasLocalAudio) return null;

  return (
    <div
      className="audioPreviewToolbarCapsule"
      role="toolbar"
      aria-label="音频工具"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={`audioPreviewToolbarCapsule-btn audioPreviewToolbarCapsule-btn--rate ${RF_NODE_INPUT_CLASS}`}
        title="播放倍速"
        onClick={onCycleRate}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {formatPlaybackRateLabel(playbackRate)}
      </button>
      <button
        type="button"
        className={`audioPreviewToolbarCapsule-btn ${RF_NODE_INPUT_CLASS}`}
        title="下载音频"
        aria-label="下载音频"
        disabled={pathLoading}
        onClick={onDownload}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <IconDownload />
      </button>
    </div>
  );
}
