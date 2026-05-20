import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { resolveProjectAssetSrc } from "@/lib/projectMediaUrl";
import { useResolvedAssetRelPath } from "@/hooks/useResolvedAssetRelPath";
import { useVideoNodeUpload } from "@/hooks/useVideoNodeUpload";
import { defaultVideoNodePersisted } from "@/lib/videoNodeTypes";
import { VideoMinimalPlayer } from "@/components/nodes/VideoMinimalPlayer";
import { VideoSubtitleRegionOverlay } from "@/components/nodes/VideoSubtitleRegionOverlay";

type Props = {
  nodeId: string;
  relPath: string | undefined;
  assetId?: string;
  onVideoMeta?: (size: { w: number; h: number }) => void;
  onDurationChange?: (sec: number) => void;
};

/** 画布视频预览：自定义播放条 + 右上上传 */
export function VideoChromePreview({
  nodeId,
  relPath,
  assetId,
  onVideoMeta,
  onDurationChange,
}: Props) {
  const projectPath = useProjectStore((s) => s.projectPath);
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const videoBlock = useProjectStore(
    (s) => s.nodes.find((n) => n.id === nodeId)?.data.video ?? defaultVideoNodePersisted(),
  );
  const patchVideoSourceTrim = useProjectStore((s) => s.patchVideoSourceTrim);
  const setVideoSourceMeta = useProjectStore((s) => s.setVideoSourceMeta);
  const patchVideoSubtitleRegion = useProjectStore((s) => s.patchVideoSubtitleRegion);
  const exportVideoTrim = useProjectStore((s) => s.exportVideoTrim);
  const exportVideoSubtitleDelogo = useProjectStore((s) => s.exportVideoSubtitleDelogo);
  const trimEditing = useCanvasUiStore((s) => s.videoTrimEditingNodeId === nodeId);
  const subtitleRegionEditing = useCanvasUiStore((s) => s.videoSubtitleRegionEditingNodeId === nodeId);
  const setVideoTrimEditingNodeId = useCanvasUiStore((s) => s.setVideoTrimEditingNodeId);
  const setVideoSubtitleRegionEditingNodeId = useCanvasUiStore(
    (s) => s.setVideoSubtitleRegionEditingNodeId,
  );
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const { uploadVideo } = useVideoNodeUpload(nodeId);
  const { effectiveRelPath, loading } = useResolvedAssetRelPath(relPath, assetId);
  const src = useMemo(
    () => resolveProjectAssetSrc(projectPath, effectiveRelPath ?? undefined),
    [projectPath, effectiveRelPath],
  );
  const [broken, setBroken] = useState(false);
  const [subtitleBusy, setSubtitleBusy] = useState(false);

  const intrinsicW = videoBlock.sourceWidth ?? 0;
  const intrinsicH = videoBlock.sourceHeight ?? 0;
  const subtitleRegion = videoBlock.subtitleRegion;

  const onTrimCancel = useCallback(() => {
    setVideoTrimEditingNodeId(null);
  }, [setVideoTrimEditingNodeId]);

  const onTrimExport = useCallback(() => {
    void exportVideoTrim(nodeId);
  }, [exportVideoTrim, nodeId]);

  const onSubtitleCancel = useCallback(() => {
    setVideoSubtitleRegionEditingNodeId(null);
    setStatusText("已取消框选");
  }, [setStatusText, setVideoSubtitleRegionEditingNodeId]);

  const onSubtitleApply = useCallback(() => {
    if (subtitleRegion) {
      patchVideoSubtitleRegion(nodeId, subtitleRegion);
    }
    setSubtitleBusy(true);
    void exportVideoSubtitleDelogo(nodeId).finally(() => setSubtitleBusy(false));
  }, [exportVideoSubtitleDelogo, nodeId, patchVideoSubtitleRegion, subtitleRegion]);

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

  return (
    <div className="vidChromePreview" ref={previewContainerRef}>
      <VideoMinimalPlayer
        src={src}
        trimEditing={trimEditing}
        trimRange={videoBlock.sourceTrim}
        onTrimChange={(trim) => patchVideoSourceTrim(nodeId, trim)}
        onTrimCancel={onTrimCancel}
        onTrimExport={onTrimExport}
        onLoadedMetadata={(w, h, duration) => {
          if (w > 0 && h > 0) onVideoMeta?.({ w, h });
          if (duration > 0) {
            onDurationChange?.(duration);
            setVideoSourceMeta(nodeId, { durationSec: duration, width: w, height: h });
          }
        }}
        onError={() => setBroken(true)}
      />
      {subtitleRegionEditing && subtitleRegion && intrinsicW > 0 && intrinsicH > 0 ? (
        <VideoSubtitleRegionOverlay
          containerRef={previewContainerRef}
          intrinsicWidth={intrinsicW}
          intrinsicHeight={intrinsicH}
          region={subtitleRegion}
          onRegionChange={(region) => patchVideoSubtitleRegion(nodeId, region)}
          onCancel={onSubtitleCancel}
          onApply={onSubtitleApply}
          busy={subtitleBusy}
        />
      ) : null}
      <button
        type="button"
        className="vidChromePreview-upload"
        title="上传视频"
        aria-label="上传视频"
        onClick={() => void uploadVideo()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 3v12M8.5 7.5 12 3l3.5 4.5M5 19h14"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
