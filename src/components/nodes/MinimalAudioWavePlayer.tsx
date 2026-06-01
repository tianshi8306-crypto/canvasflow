import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isTauri } from "@tauri-apps/api/core";
import { pickAudioPathsForImport } from "@/lib/tauriMediaPaths";
import { paintAudioWaveform } from "@/lib/audioWaveformDraw";
import { useAudioWaveformPeaks } from "@/hooks/useAudioWaveformPeaks";
import { useProjectAudioPlaybackSrc } from "@/hooks/useProjectAudioPlaybackSrc";
import { useResolvedAssetRelPath } from "@/hooks/useResolvedAssetRelPath";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";
import { DESKTOP_SHELL_HINT } from "@/lib/tauriEnv";
import { queryKeys } from "@/shared/queryKeys";
import { useProjectStore } from "@/store/projectStore";

const PLAYBACK_RATES = [1, 1.25, 1.5, 2] as const;

function formatSec(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "00:00";
  const s = Math.floor(sec);
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

type Props = {
  nodeId: string;
  relPath: string | undefined;
  assetId?: string;
  playbackRate?: number;
  showReplace?: boolean;
};

export function formatPlaybackRateLabel(rate: number): string {
  return rate === 1 ? "1x" : `${rate}x`;
}

export function nextPlaybackRate(rate: number): number {
  const i = PLAYBACK_RATES.indexOf(rate as (typeof PLAYBACK_RATES)[number]);
  const next = i < 0 ? 0 : (i + 1) % PLAYBACK_RATES.length;
  return PLAYBACK_RATES[next]!;
}

export function MinimalAudioWavePlayer({
  nodeId,
  relPath,
  assetId,
  playbackRate = 1,
  showReplace = false,
}: Props) {
  const queryClient = useQueryClient();
  const projectPath = useProjectStore((s) => s.projectPath);
  const assignImportedMediaToNode = useProjectStore((s) => s.assignImportedMediaToNode);
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const { effectiveRelPath, loading: pathLoading } = useResolvedAssetRelPath(relPath, assetId);
  const {
    src,
    loading: srcLoading,
    failed: srcFailed,
  } = useProjectAudioPlaybackSrc(projectPath, effectiveRelPath);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveWrapRef = useRef<HTMLDivElement>(null);

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const { peaks, loading: waveLoading } = useAudioWaveformPeaks(
    projectPath,
    effectiveRelPath,
    src,
  );
  const [broken, setBroken] = useState(false);

  const ratio = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;

  const redrawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    paintAudioWaveform(canvas, { peaks, progress: ratio, loading: waveLoading });
  }, [peaks, ratio, waveLoading]);

  useEffect(() => {
    setBroken(false);
  }, [src]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    redrawWaveform();
  }, [redrawWaveform]);

  useEffect(() => {
    const wrap = waveWrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => redrawWaveform());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [redrawWaveform]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    a.currentTime = 0;
    setCurrentTime(0);
    setPlaying(false);
  }, [src]);

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      void a.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      );
    } else {
      a.pause();
      setPlaying(false);
    }
  }, []);

  const onSeek = useCallback(
    (ev: React.MouseEvent<HTMLDivElement>) => {
      const a = audioRef.current;
      if (!a || !duration) return;
      const rect = ev.currentTarget.getBoundingClientRect();
      const x = Math.min(Math.max(0, ev.clientX - rect.left), rect.width);
      const next = (x / rect.width) * duration;
      a.currentTime = next;
      setCurrentTime(next);
    },
    [duration],
  );

  const onReplace = useCallback(async () => {
    if (!isTauri()) {
      setStatusText(DESKTOP_SHELL_HINT);
      return;
    }
    const paths = await pickAudioPathsForImport(false);
    if (paths?.length) {
      await assignImportedMediaToNode(nodeId, paths);
      if (projectPath) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.assets.list(projectPath) });
      }
      setStatusText("已替换音频");
    }
  }, [assignImportedMediaToNode, nodeId, projectPath, queryClient, setStatusText]);

  if (!projectPath) {
    return <div className="minimal-audio-wave-player minimal-audio-wave-player--muted">打开工程后可预览</div>;
  }
  if (pathLoading || srcLoading) {
    return <div className="minimal-audio-wave-player minimal-audio-wave-player--muted">解析素材…</div>;
  }
  if (!effectiveRelPath) {
    return <div className="minimal-audio-wave-player minimal-audio-wave-player--muted">未找到素材</div>;
  }
  if (!src || broken || srcFailed) {
    return <div className="minimal-audio-wave-player minimal-audio-wave-player--muted">预览失败</div>;
  }

  return (
    <div className={`minimal-audio-wave-player${playing ? " minimal-audio-wave-player--playing" : ""}`}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime || 0)}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
        }}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onError={() => setBroken(true)}
      />
      <div className="minimal-audio-wave-player__stage">
        {showReplace ? (
          <button
            type="button"
            className={`minimal-audio-wave-player__replace ${RF_NODE_INPUT_CLASS}`}
            title="替换音频"
            aria-label="替换音频"
            onClick={(e) => {
              e.stopPropagation();
              void onReplace();
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : null}
        <div
          ref={waveWrapRef}
          className={`minimal-audio-wave-player__wave ${RF_NODE_INPUT_CLASS}`}
          role="slider"
          tabIndex={0}
          aria-label="音频波形，点击跳转播放位置"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={currentTime}
          onClick={onSeek}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              togglePlay();
            }
          }}
        >
          <canvas ref={canvasRef} className="minimal-audio-wave-player__canvas" aria-hidden />
          {waveLoading ? (
            <span className="minimal-audio-wave-player__loading">分析波形…</span>
          ) : null}
        </div>
      </div>
      <div className="minimal-audio-wave-player__controls">
        <span className="minimal-audio-wave-player__time">
          <span className="minimal-audio-wave-player__time-cur">{formatSec(currentTime)}</span>
          <span className="minimal-audio-wave-player__time-sep"> / </span>
          <span className="minimal-audio-wave-player__time-dur">{formatSec(duration)}</span>
        </span>
        <button
          type="button"
          className={`minimal-audio-wave-player__play ${RF_NODE_INPUT_CLASS}`}
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={playing ? "暂停" : "播放"}
          title={playing ? "暂停" : "播放"}
        >
          {playing ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5.5v13l10-7.5L8 5.5z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
