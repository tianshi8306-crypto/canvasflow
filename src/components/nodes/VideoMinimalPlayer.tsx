import { useCallback, useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";
import { normalizeVideoSourceTrim } from "@/lib/videoSourceTrim";
import { promptSaveImagePath, saveImageBlobAs, writeBlobToPath } from "@/lib/saveImageBlob";
import type { VideoSourceTrim } from "@/lib/videoNodeTypes";
import { useProjectStore } from "@/store/projectStore";

function seekVideoTo(v: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(v.currentTime - time) < 0.02) {
      resolve();
      return;
    }
    const onSeeked = () => {
      v.removeEventListener("seeked", onSeeked);
      resolve();
    };
    v.addEventListener("seeked", onSeeked);
    v.currentTime = time;
  });
}

async function drawVideoFrameToPng(v: HTMLVideoElement): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = v.videoWidth;
  canvas.height = v.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(v, 0, 0);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${ss.toString().padStart(2, "0")}`;
}

type Props = {
  src: string;
  trimEditing?: boolean;
  trimRange?: VideoSourceTrim;
  onTrimChange?: (trim: VideoSourceTrim) => void;
  onTrimCancel?: () => void;
  onTrimExport?: () => void;
  onLoadedMetadata?: (width: number, height: number, duration: number) => void;
  onError?: () => void;
};

type TrimDragKind = "in" | "out" | "seek";

/** 预览区内置播放条（对齐 LibTV 参考布局） */
export function VideoMinimalPlayer({
  src,
  trimEditing = false,
  trimRange,
  onTrimChange,
  onTrimCancel,
  onTrimExport,
  onLoadedMetadata,
  onError,
}: Props) {
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const volWrapRef = useRef<HTMLDivElement>(null);
  const volTrackRef = useRef<HTMLDivElement>(null);
  const captureWrapRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showVolume, setShowVolume] = useState(false);
  const [captureMenuOpen, setCaptureMenuOpen] = useState(false);
  const capturingRef = useRef(false);
  const trimDragRef = useRef<TrimDragKind | null>(null);

  const ratio = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  const volPct = Math.round(volume * 100);

  const trimInRatio =
    trimEditing && trimRange && duration > 0
      ? Math.min(1, Math.max(0, trimRange.inSec / duration))
      : 0;
  const trimOutRatio =
    trimEditing && trimRange && duration > 0
      ? Math.min(1, Math.max(trimInRatio, trimRange.outSec / duration))
      : 1;

  useEffect(() => {
    if (!trimEditing || !trimRange || !duration) return;
    const v = videoRef.current;
    if (!v) return;
    if (v.currentTime < trimRange.inSec) v.currentTime = trimRange.inSec;
    if (v.currentTime > trimRange.outSec) v.currentTime = trimRange.outSec;
  }, [trimEditing, trimRange, duration, currentTime]);

  useEffect(() => {
    if (!showVolume && !captureMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (captureMenuOpen && !captureWrapRef.current?.contains(t)) {
        setCaptureMenuOpen(false);
      }
      if (showVolume && !volWrapRef.current?.contains(t)) {
        setShowVolume(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [captureMenuOpen, showVolume]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
    } else {
      v.pause();
    }
  }, []);

  const timeFromClientX = useCallback(
    (clientX: number) => {
      const rect = progressRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0 || !duration) return 0;
      const x = Math.min(Math.max(0, clientX - rect.left), rect.width);
      return (x / rect.width) * duration;
    },
    [duration],
  );

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const v = videoRef.current;
      if (!v || !duration) return;
      let t = timeFromClientX(clientX);
      if (trimEditing && trimRange) {
        t = Math.min(trimRange.outSec, Math.max(trimRange.inSec, t));
      }
      v.currentTime = t;
    },
    [duration, timeFromClientX, trimEditing, trimRange],
  );

  const applyTrimFromClientX = useCallback(
    (kind: TrimDragKind, clientX: number) => {
      if (!trimRange || !duration || !onTrimChange) return;
      const t = timeFromClientX(clientX);
      const next =
        kind === "in"
          ? { inSec: t, outSec: trimRange.outSec }
          : kind === "out"
            ? { inSec: trimRange.inSec, outSec: t }
            : trimRange;
      onTrimChange(normalizeVideoSourceTrim(next, duration));
    },
    [duration, onTrimChange, timeFromClientX, trimRange],
  );

  const onProgressPointerDown = useCallback(
    (ev: React.PointerEvent<HTMLDivElement>) => {
      ev.preventDefault();
      ev.stopPropagation();
      ev.currentTarget.setPointerCapture(ev.pointerId);
      if (trimEditing && trimRange && duration > 0) {
        const t = timeFromClientX(ev.clientX);
        const inDist = Math.abs(t - trimRange.inSec);
        const outDist = Math.abs(t - trimRange.outSec);
        const hitSec = Math.max(0.15, duration * 0.04);
        if (inDist <= outDist && inDist < hitSec) {
          trimDragRef.current = "in";
          applyTrimFromClientX("in", ev.clientX);
        } else if (outDist < hitSec) {
          trimDragRef.current = "out";
          applyTrimFromClientX("out", ev.clientX);
        } else {
          trimDragRef.current = "seek";
          seekFromClientX(ev.clientX);
        }
        return;
      }
      trimDragRef.current = "seek";
      seekFromClientX(ev.clientX);
    },
    [applyTrimFromClientX, duration, seekFromClientX, timeFromClientX, trimEditing, trimRange],
  );

  const onProgressPointerMove = useCallback(
    (ev: React.PointerEvent<HTMLDivElement>) => {
      if (!ev.currentTarget.hasPointerCapture(ev.pointerId)) return;
      const kind = trimDragRef.current;
      if (kind === "in" || kind === "out") {
        applyTrimFromClientX(kind, ev.clientX);
        return;
      }
      seekFromClientX(ev.clientX);
    },
    [applyTrimFromClientX, seekFromClientX],
  );

  const onProgressPointerUp = useCallback(() => {
    trimDragRef.current = null;
  }, []);

  const setVolumeLevel = useCallback((next: number) => {
    const v = Math.min(1, Math.max(0, next));
    setVolume(v);
    if (videoRef.current) videoRef.current.volume = v;
  }, []);

  const volumeFromClientY = useCallback(
    (clientY: number) => {
      const rect = volTrackRef.current?.getBoundingClientRect();
      if (!rect || rect.height <= 0) return;
      const y = Math.min(Math.max(0, clientY - rect.top), rect.height);
      setVolumeLevel(1 - y / rect.height);
    },
    [setVolumeLevel],
  );

  const onVolTrackPointerDown = useCallback(
    (ev: React.PointerEvent<HTMLDivElement>) => {
      ev.preventDefault();
      ev.stopPropagation();
      ev.currentTarget.setPointerCapture(ev.pointerId);
      volumeFromClientY(ev.clientY);
    },
    [volumeFromClientY],
  );

  const onVolTrackPointerMove = useCallback(
    (ev: React.PointerEvent<HTMLDivElement>) => {
      if (!ev.currentTarget.hasPointerCapture(ev.pointerId)) return;
      volumeFromClientY(ev.clientY);
    },
    [volumeFromClientY],
  );

  const captureAt = useCallback(
    async (mode: "current" | "first" | "last") => {
      const v = videoRef.current;
      if (!v || v.videoWidth <= 0) {
        setStatusText("无法截取画面");
        return;
      }
      if (capturingRef.current) return;

      const labels = {
        current: { busy: "正在截取当前帧…", ok: "已保存当前帧", file: "frame-current" },
        first: { busy: "正在截取首帧…", ok: "已保存首帧", file: "frame-first" },
        last: { busy: "正在截取尾帧…", ok: "已保存尾帧", file: "frame-last" },
      } as const;
      const label = labels[mode];
      const defaultName = `${label.file}-${Date.now()}.png`;

      setCaptureMenuOpen(false);

      let savePath: string | null = null;
      if (isTauri()) {
        savePath = await promptSaveImagePath(defaultName);
        if (!savePath) {
          setStatusText("已取消保存");
          return;
        }
      }

      capturingRef.current = true;

      const savedTime = v.currentTime;
      const wasPlaying = !v.paused;
      v.pause();

      setStatusText(label.busy);

      try {
        if (mode === "first") {
          await seekVideoTo(v, 0);
        } else if (mode === "last") {
          if (!(duration > 0)) {
            setStatusText("无法截取尾帧：视频时长未知");
            return;
          }
          await seekVideoTo(v, Math.max(0, duration - 0.05));
        }

        const blob = await drawVideoFrameToPng(v);
        if (!blob) {
          setStatusText("截图失败");
          return;
        }
        if (isTauri() && savePath) {
          await writeBlobToPath(blob, savePath);
          const base = savePath.split(/[/\\]/).pop() ?? savePath;
          setStatusText(`${label.ok}：${base}`);
        } else {
          const saved = await saveImageBlobAs(blob, defaultName);
          setStatusText(saved ? label.ok : "已取消保存");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatusText(`截图失败：${msg}`);
      } finally {
        try {
          await seekVideoTo(v, savedTime);
        } catch {
          v.currentTime = savedTime;
        }
        if (wasPlaying) void v.play();
        capturingRef.current = false;
      }
    },
    [duration, setStatusText],
  );

  return (
    <div className="vidMinimalPlayer">
      <video
        ref={videoRef}
        src={src}
        className="vidMinimalPlayerMedia"
        preload="metadata"
        playsInline
        crossOrigin="anonymous"
        onClick={togglePlay}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          const d = el.duration || 0;
          setDuration(d);
          setVolume(el.volume);
          onLoadedMetadata?.(el.videoWidth, el.videoHeight, d);
        }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime || 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={onError}
      />

      {trimEditing && trimRange ? (
        <div
          className={`vidMinimalPlayerTrimBar ${RF_NODE_INPUT_CLASS}`}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span className="vidMinimalPlayerTrimLabel">
            裁剪 {formatTime(trimRange.inSec)} – {formatTime(trimRange.outSec)}
          </span>
          <div className="vidMinimalPlayerTrimActions">
            <button type="button" className="vidMinimalPlayerTrimBtn" onClick={onTrimExport}>
              导出裁剪
            </button>
            <button
              type="button"
              className="vidMinimalPlayerTrimBtn vidMinimalPlayerTrimBtn--ghost"
              onClick={onTrimCancel}
            >
              取消
            </button>
          </div>
        </div>
      ) : null}

      <div
        className={`vidMinimalPlayerControls ${RF_NODE_INPUT_CLASS}`}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="vidMinimalPlayerCtrlBtn"
          onClick={togglePlay}
          aria-label={playing ? "暂停" : "播放"}
        >
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
              <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
              <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
              <path d="M10 8.5v7l6-3.5-6-3.5Z" fill="currentColor" />
            </svg>
          )}
        </button>

        <span className="vidMinimalPlayerTime vidMinimalPlayerTime--current">
          {formatTime(currentTime)}
        </span>

        <div
          className={`vidMinimalPlayerProgress${trimEditing ? " vidMinimalPlayerProgress--trim" : ""}`}
          ref={progressRef}
          onPointerDown={onProgressPointerDown}
          onPointerMove={onProgressPointerMove}
          onPointerUp={onProgressPointerUp}
          onPointerCancel={onProgressPointerUp}
          role="slider"
          aria-label={trimEditing ? "裁剪区间" : "播放进度"}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(ratio * 100)}
        >
          <div className="vidMinimalPlayerProgressTrack">
            {trimEditing ? (
              <>
                <div
                  className="vidMinimalPlayerTrimDim"
                  style={{ left: 0, width: `${trimInRatio * 100}%` }}
                  aria-hidden
                />
                <div
                  className="vidMinimalPlayerTrimActive"
                  style={{
                    left: `${trimInRatio * 100}%`,
                    width: `${(trimOutRatio - trimInRatio) * 100}%`,
                  }}
                  aria-hidden
                />
                <div
                  className="vidMinimalPlayerTrimDim"
                  style={{
                    left: `${trimOutRatio * 100}%`,
                    width: `${(1 - trimOutRatio) * 100}%`,
                  }}
                  aria-hidden
                />
                <div
                  className="vidMinimalPlayerTrimHandle vidMinimalPlayerTrimHandle--in"
                  style={{ left: `${trimInRatio * 100}%` }}
                  aria-hidden
                />
                <div
                  className="vidMinimalPlayerTrimHandle vidMinimalPlayerTrimHandle--out"
                  style={{ left: `${trimOutRatio * 100}%` }}
                  aria-hidden
                />
              </>
            ) : null}
            <div className="vidMinimalPlayerProgressFill" style={{ width: `${ratio * 100}%` }} />
            <div className="vidMinimalPlayerProgressThumb" style={{ left: `${ratio * 100}%` }} />
          </div>
        </div>

        <span className="vidMinimalPlayerTime vidMinimalPlayerTime--total">{formatTime(duration)}</span>

        <div className="vidMinimalPlayerVolWrap" ref={volWrapRef}>
          {showVolume ? (
            <div className="vidMinimalPlayerVolPop" onPointerDown={(e) => e.stopPropagation()}>
              <span className="vidMinimalPlayerVolPct">{volPct}</span>
              <div
                className="vidMinimalPlayerVolTrack"
                role="slider"
                aria-label="音量"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={volPct}
                ref={volTrackRef}
                onPointerDown={onVolTrackPointerDown}
                onPointerMove={onVolTrackPointerMove}
              >
                <div className="vidMinimalPlayerVolTrackLine" aria-hidden />
                <div
                  className="vidMinimalPlayerVolTrackFill"
                  style={{ height: `${volPct}%` }}
                  aria-hidden
                />
                <div
                  className="vidMinimalPlayerVolThumb"
                  style={{ bottom: `${volPct}%` }}
                  aria-hidden
                />
              </div>
            </div>
          ) : null}
          <button
            type="button"
            className={`vidMinimalPlayerCtrlBtn${showVolume ? " is-active" : ""}`}
            aria-label="音量"
            aria-expanded={showVolume}
            onClick={() => setShowVolume((v) => !v)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M11 5 6 9H2v6h4l5 4V5z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              {volume > 0.01 ? (
                <path
                  d="M15 8.5a4 4 0 0 1 0 7M17.5 6a6.5 6.5 0 0 1 0 12"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              ) : null}
            </svg>
          </button>
        </div>

        <div className="vidMinimalPlayerCaptureWrap" ref={captureWrapRef}>
          {captureMenuOpen ? (
            <div
              className="vidMinimalPlayerCaptureMenu"
              role="menu"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="vidMinimalPlayerCaptureMenuItem"
                role="menuitem"
                onClick={() => void captureAt("current")}
              >
                截取当前帧
              </button>
              <button
                type="button"
                className="vidMinimalPlayerCaptureMenuItem"
                role="menuitem"
                onClick={() => void captureAt("first")}
              >
                截取首帧
              </button>
              <button
                type="button"
                className="vidMinimalPlayerCaptureMenuItem"
                role="menuitem"
                onClick={() => void captureAt("last")}
              >
                截取尾帧
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className={`vidMinimalPlayerCaptureBtn${captureMenuOpen ? " is-open" : ""}`}
            aria-label="截帧"
            aria-expanded={captureMenuOpen}
            aria-haspopup="menu"
            onClick={() => setCaptureMenuOpen((o) => !o)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect
                x="4"
                y="6"
                width="16"
                height="12"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
