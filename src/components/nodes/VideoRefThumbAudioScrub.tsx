import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useProjectStore } from "@/store/projectStore";
import { resolveProjectAssetSrc } from "@/lib/projectMediaUrl";
import { useResolvedAssetRelPath } from "@/hooks/useResolvedAssetRelPath";

type AudioPlayerState = {
  playing: boolean;
  canPlay: boolean;
  ratio: number;
  togglePlay: (e: MouseEvent) => void;
  onSeek: (e: MouseEvent<HTMLDivElement>) => void;
};

const RefThumbAudioContext = createContext<AudioPlayerState | null>(null);

function useRefThumbAudioContext(): AudioPlayerState {
  const ctx = useContext(RefThumbAudioContext);
  if (!ctx) {
    return {
      playing: false,
      canPlay: false,
      ratio: 0,
      togglePlay: () => {},
      onSeek: () => {},
    };
  }
  return ctx;
}

/** 参考条音频：共享播放状态（中心播放钮 + 下方进度条） */
export function VideoRefThumbAudioProvider({ relPath, assetId, children }: {
  relPath?: string;
  assetId?: string;
  children: ReactNode;
}) {
  const projectPath = useProjectStore((s) => s.projectPath);
  const { effectiveRelPath, loading } = useResolvedAssetRelPath(relPath, assetId);
  const src = useMemo(
    () => resolveProjectAssetSrc(projectPath, effectiveRelPath ?? undefined),
    [projectPath, effectiveRelPath],
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const ratio = duration > 0 ? Math.min(1, current / duration) : 0;
  const canPlay = Boolean(src) && !loading;

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    a.currentTime = 0;
    setCurrent(0);
    setPlaying(false);
  }, [src]);

  const togglePlay = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      const a = audioRef.current;
      if (!a || !src) return;
      if (a.paused) {
        void a.play().then(
          () => setPlaying(true),
          () => setPlaying(false),
        );
      } else {
        a.pause();
        setPlaying(false);
      }
    },
    [src],
  );

  const onSeek = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      const a = audioRef.current;
      if (!a || !duration) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.min(Math.max(0, e.clientX - rect.left), rect.width);
      a.currentTime = (x / rect.width) * duration;
      setCurrent(a.currentTime);
    },
    [duration],
  );

  const value = useMemo(
    () => ({ playing, canPlay, ratio, togglePlay, onSeek }),
    [playing, canPlay, ratio, togglePlay, onSeek],
  );

  return (
    <RefThumbAudioContext.Provider value={value}>
      {src ? (
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime || 0)}
          onEnded={() => {
            setPlaying(false);
            setCurrent(0);
          }}
          onPause={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
        />
      ) : null}
      {children}
    </RefThumbAudioContext.Provider>
  );
}

/** 缩略图正中蓝色播放钮（与相邻图/视频 thumb 同尺寸、同对齐） */
export function VideoRefThumbAudioCenterPlay({ disabled = false }: { disabled?: boolean }) {
  const { playing, canPlay, togglePlay } = useRefThumbAudioContext();
  return (
    <button
      type="button"
      className="mmThumbAudioCenterPlay"
      aria-label={playing ? "暂停" : "播放"}
      disabled={disabled || !canPlay}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={togglePlay}
    >
      {playing ? "❚❚" : "▶"}
    </button>
  );
}
