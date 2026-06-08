import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useProjectStore } from "@/store/projectStore";
import { resolveProjectAssetSrc } from "@/lib/projectMediaUrl";
import { useResolvedAssetRelPath } from "@/hooks/useResolvedAssetRelPath";

type Kind = "image" | "video" | "audio";

type NodeMediaPreviewProps = {
  /** 工程相对路径（如 `assets/a.png`）；无 `assetId` 时用于预览 */
  relPath: string | undefined;
  /** 若存在则优先查库解析为 `rel_path`（M1-3.2） */
  assetId?: string;
  kind: Kind;
  /** 仅 `kind="image"`：覆盖 img 的 class */
  imageClassName?: string;
  /** 仅 `kind="image"`：覆盖 img 的行内样式（悬停预览等需精确 contain 缩放） */
  imageStyle?: CSSProperties;
  /** 仅 `kind="video"`：覆盖 video 的 class */
  videoClassName?: string;
  /** 仅 `kind="video"`：覆盖 video 的行内样式 */
  videoStyle?: CSSProperties;
  /** 仅 `kind="video"`：是否显示原生控制条（缩略图条建议 false） */
  videoControls?: boolean;
  /** 仅 `kind="video"`：缩略条内 muted 自动播放 */
  videoAutoPlay?: boolean;
  videoLoop?: boolean;
  /** 仅 `kind="image"`：lazy / eager（悬停预览建议 eager） */
  imageLoading?: "lazy" | "eager";
  /** 仅 `kind="image"`：图片加载完成回调 */
  onImageLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  /** 仅 `kind="image"`：挂载/更新时回调（用于读取 naturalWidth 缓存图） */
  onImageElement?: (el: HTMLImageElement | null) => void;
  /** 仅 `kind="video"`：视频元数据加载完成 */
  onVideoLoadedMetadata?: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
};

function formatSec(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "00:00";
  const s = Math.floor(sec);
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function downsamplePcmToWave(pcm: Float32Array, bars: number): number[] {
  if (!pcm.length || bars <= 0) return [];
  const windowSize = Math.max(1, Math.floor(pcm.length / bars));
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    const start = i * windowSize;
    const end = Math.min(pcm.length, start + windowSize);
    if (start >= end) {
      out.push(0);
      continue;
    }
    // RMS 作为窗口音量能量，较峰值更稳定
    let sumSq = 0;
    for (let j = start; j < end; j++) {
      const v = pcm[j]!;
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / (end - start));
    out.push(rms);
  }
  const max = Math.max(...out, 0.0001);
  return out.map((v) => Math.max(0.08, Math.min(1, v / max)));
}

function AudioWavePreview({ src, onBroken }: { src: string; onBroken: () => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [wave, setWave] = useState<number[]>([]);
  const [waveLoading, setWaveLoading] = useState(true);
  const ratio = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  const bars = wave.length ? wave : new Array(56).fill(0.2);

  useEffect(() => {
    let cancelled = false;
    const build = async () => {
      setWaveLoading(true);
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
        const buf = await res.arrayBuffer();
        const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) throw new Error("AudioContext unavailable");
        const ctx = new Ctx();
        try {
          const decoded = await ctx.decodeAudioData(buf.slice(0));
          const raw = decoded.getChannelData(0);
          const samples = downsamplePcmToWave(raw, 64);
          if (!cancelled) setWave(samples);
        } finally {
          void ctx.close();
        }
      } catch {
        if (!cancelled) {
          setWave([]);
        }
      } finally {
        if (!cancelled) setWaveLoading(false);
      }
    };
    void build();
    return () => {
      cancelled = true;
    };
  }, [src]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    a.currentTime = 0;
    setCurrentTime(0);
    setPlaying(false);
  }, [src]);

  const togglePlay = () => {
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
  };

  const onSeek = (ev: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !duration) return;
    const rect = ev.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max(0, ev.clientX - rect.left), rect.width);
    const next = (x / rect.width) * duration;
    a.currentTime = next;
    setCurrentTime(next);
  };

  return (
    <div className="nodeMediaAudioWave">
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
        onError={onBroken}
      />
      <div
        className="nodeMediaAudioWaveBars"
        role="button"
        tabIndex={0}
        aria-label="音频波形，点击跳转播放位置"
        onClick={onSeek}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            togglePlay();
          }
        }}
      >
        {bars.map((h, idx) => {
          const pos = (idx + 1) / bars.length;
          const active = pos <= ratio;
          return (
            <span
              key={`${idx}-${h.toFixed(3)}`}
              className={`nodeMediaAudioWaveBar${active ? " is-active" : ""}`}
              style={{ height: `${Math.round(24 + h * 48)}px` }}
            />
          );
        })}
      </div>
      {waveLoading ? <div className="nodeMediaAudioWaveLoading">正在分析真实波形…</div> : null}
      <div className="nodeMediaAudioWaveFooter">
        <span className="nodeMediaAudioWaveTime">
          {formatSec(currentTime)} / {formatSec(duration)}
        </span>
        <button
          type="button"
          className="nodeMediaAudioWavePlay"
          onClick={togglePlay}
          aria-label={playing ? "暂停音频" : "播放音频"}
          title={playing ? "暂停" : "播放"}
        >
          {playing ? "❚❚" : "▶"}
        </button>
      </div>
    </div>
  );
}

function NodeImagePreview({
  src,
  imageClassName,
  imageStyle,
  imageLoading,
  onImageLoad,
  onImageElement,
  onBroken,
}: {
  src: string;
  imageClassName?: string;
  imageStyle?: CSSProperties;
  imageLoading: "lazy" | "eager";
  onImageLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  onImageElement?: (el: HTMLImageElement | null) => void;
  onBroken: () => void;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);

  useLayoutEffect(() => {
    const el = imgRef.current;
    if (el?.complete && el.naturalWidth > 0) onImageElement?.(el);
  }, [src, onImageElement]);

  return (
    <img
      ref={imgRef}
      src={src}
      alt=""
      className={imageClassName ?? "nodeThumb"}
      style={imageStyle}
      onLoad={onImageLoad}
      onError={onBroken}
      loading={imageLoading}
      decoding="async"
    />
  );
}

export function NodeMediaPreview({
  relPath,
  assetId,
  kind,
  imageClassName,
  imageStyle,
  imageLoading = "lazy",
  videoClassName,
  videoStyle,
  videoControls = true,
  videoAutoPlay = false,
  videoLoop = false,
  onImageLoad,
  onImageElement,
  onVideoLoadedMetadata,
}: NodeMediaPreviewProps) {
  const projectPath = useProjectStore((s) => s.projectPath);
  const { effectiveRelPath, loading } = useResolvedAssetRelPath(relPath, assetId);
  const src = useMemo(
    () => resolveProjectAssetSrc(projectPath, effectiveRelPath ?? undefined),
    [projectPath, effectiveRelPath],
  );
  const [broken, setBroken] = useState(false);
  useEffect(() => {
     
    setBroken(false);
  }, [src]);

  const hasRef = Boolean(relPath?.trim() || assetId?.trim());
  if (!hasRef) {
    return <div className="nodeMutedPreview">未设置路径</div>;
  }
  if (!projectPath) {
    return <div className="nodeMutedPreview">打开工程后可预览素材</div>;
  }
  if (loading) {
    return <div className="nodeMutedPreview">解析素材…</div>;
  }
  if (!effectiveRelPath) {
    return <div className="nodeMutedPreview">未找到素材</div>;
  }
  if (!src || broken) {
    return <div className="nodeMutedPreview">{broken ? "预览失败" : "无法解析预览地址"}</div>;
  }

  if (kind === "image") {
    return (
      <NodeImagePreview
        src={src}
        imageClassName={imageClassName}
        imageStyle={imageStyle}
        imageLoading={imageLoading}
        onImageLoad={onImageLoad}
        onImageElement={onImageElement}
        onBroken={() => setBroken(true)}
      />
    );
  }
  if (kind === "video") {
    return (
      <div
        tabIndex={0}
        className="nodeMediaVideoWrapper"
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Spacebar") {
            e.preventDefault();
            const video = e.currentTarget.querySelector("video");
            if (!video) return;
            if (video.paused) {
              void video.play();
            } else {
              video.pause();
            }
          }
        }}
      >
        <video
          key={src}
          src={src}
          className={videoClassName ?? "nodeMediaClip"}
          style={videoStyle}
          muted
          autoPlay={videoAutoPlay}
          loop={videoLoop}
          playsInline
          controls={videoControls}
          preload={videoAutoPlay ? "auto" : "metadata"}
          onLoadedMetadata={onVideoLoadedMetadata}
          onError={() => setBroken(true)}
        />
      </div>
    );
  }
  return <AudioWavePreview src={src} onBroken={() => setBroken(true)} />;
}
