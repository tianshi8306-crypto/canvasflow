import { useEffect, useMemo, useRef } from "react";

import { useResolvedAssetRelPath } from "@/hooks/useResolvedAssetRelPath";

import { resolveProjectAssetSrc } from "@/lib/projectMediaUrl";

import { useProjectStore } from "@/store/projectStore";



type Props = {

  mode: "clip" | "output";

  clipPath: string | null;

  outputPath: string | undefined;

  seekInClipSec: number;

  sequencePlaying: boolean;

  onClipDuration?: (relPath: string, sec: number) => void;

  setVideoElement: (el: HTMLVideoElement | null) => void;

  onClipEnded: () => void;

  onPlaybackTime: (currentInClip: number) => void;

  onPlayStateChange: (playing: boolean) => void;

  onTogglePlay: () => void;

};



export function ComposeEditorPreview({

  mode,

  clipPath,

  outputPath,

  seekInClipSec,

  sequencePlaying,

  onClipDuration,

  setVideoElement,

  onClipEnded,

  onPlaybackTime,

  onPlayStateChange,

  onTogglePlay,

}: Props) {

  const projectPath = useProjectStore((s) => s.projectPath);

  const previewPath = mode === "output" && outputPath ? outputPath : clipPath;

  const { effectiveRelPath, loading } = useResolvedAssetRelPath(previewPath ?? undefined, undefined);

  const src = useMemo(

    () => resolveProjectAssetSrc(projectPath, effectiveRelPath ?? undefined),

    [projectPath, effectiveRelPath],

  );



  const videoRef = useRef<HTMLVideoElement | null>(null);

  const lastSeekRef = useRef(-1);



  useEffect(() => {

    setVideoElement(videoRef.current);

    return () => setVideoElement(null);

  }, [setVideoElement, src]);



  useEffect(() => {

    const v = videoRef.current;

    if (!v) return;

    v.pause();

    onPlayStateChange(false);

    lastSeekRef.current = -1;

  }, [src, onPlayStateChange]);



  useEffect(() => {

    const v = videoRef.current;

    if (!v || !src || mode !== "clip") return;

    if (lastSeekRef.current === seekInClipSec) return;

    const apply = () => {

      if (seekInClipSec > 0 && v.duration && seekInClipSec < v.duration) {

        v.currentTime = seekInClipSec;

      }

      lastSeekRef.current = seekInClipSec;

      if (sequencePlaying) {

        void v.play();

        onPlayStateChange(true);

      }

    };

    if (v.readyState >= 1) apply();

    else v.addEventListener("loadedmetadata", apply, { once: true });

  }, [src, seekInClipSec, sequencePlaying, mode, onPlayStateChange]);



  useEffect(() => {

    const v = videoRef.current;

    if (!v || !src) return;

    const onTime = () => {

      if (mode === "clip") onPlaybackTime(v.currentTime);

    };

    const onEnd = () => {

      if (mode === "clip") onClipEnded();

    };

    const onPlay = () => onPlayStateChange(true);

    const onPause = () => onPlayStateChange(false);

    v.addEventListener("timeupdate", onTime);

    v.addEventListener("ended", onEnd);

    v.addEventListener("play", onPlay);

    v.addEventListener("pause", onPause);

    return () => {

      v.removeEventListener("timeupdate", onTime);

      v.removeEventListener("ended", onEnd);

      v.removeEventListener("play", onPlay);

      v.removeEventListener("pause", onPause);

    };

  }, [src, mode, onPlaybackTime, onClipEnded, onPlayStateChange]);



  return (

    <div className="composeEditorPreviewStage">

      <div

        className="composeEditorPreviewInner"

        onClick={() => {

          if (src) onTogglePlay();

        }}

        onKeyDown={(e) => {

          if ((e.key === "Enter" || e.key === " ") && src) {

            e.preventDefault();

            onTogglePlay();

          }

        }}

        role="button"

        tabIndex={0}

        aria-label="预览区，点击播放或暂停"

      >

        {!previewPath ? (

          <div className="composeEditorPreviewEmpty">

            <p>暂无片段</p>

            <p className="composeEditorPreviewEmptyHint">连接视频节点后，在时间线工具栏点击刷新</p>

          </div>

        ) : loading ? (

          <div className="composeEditorPreviewEmpty">加载预览…</div>

        ) : !src ? (

          <div className="composeEditorPreviewEmpty">无法解析预览</div>

        ) : (

          <video

            ref={videoRef}

            key={src}

            src={src}

            className="composeEditorVideo"

            playsInline

            onLoadedMetadata={(e) => {

              if (mode === "clip" && clipPath && onClipDuration) {

                const d = e.currentTarget.duration;

                if (Number.isFinite(d) && d > 0) onClipDuration(clipPath, d);

              }

            }}

          />

        )}

      </div>

    </div>

  );

}


