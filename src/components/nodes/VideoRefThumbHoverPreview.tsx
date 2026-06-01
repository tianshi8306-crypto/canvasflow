import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { NodeMediaPreview } from "@/components/nodes/NodeMediaPreview";
import type { VideoIncomingRefItem } from "@/hooks/useVideoIncomingReferenceItems";
import {
  fitHoverPreviewBox,
  readMediaNaturalSize,
  REF_HOVER_PREVIEW_MAX_PX,
} from "@/lib/video/refPreviewUtils";

type Props = {
  item: VideoIncomingRefItem;
  anchorRect: DOMRect;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
};

/** 参考条悬停预览（全局 Portal，对齐 LibTV 仅大图） */
export function VideoRefThumbHoverPreview({
  item,
  anchorRect,
  onPointerEnter,
  onPointerLeave,
}: Props) {
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const mediaKey = `${item.edgeId}:${item.assetId ?? ""}:${item.path ?? ""}`;

  useEffect(() => {
    setNaturalSize(null);
  }, [mediaKey]);

  const applyNaturalSize = useCallback((el: HTMLImageElement | HTMLVideoElement) => {
    const size = readMediaNaturalSize(el);
    if (!size) return;
    setNaturalSize((prev) => (prev?.w === size.w && prev?.h === size.h ? prev : size));
  }, []);

  const handleImageElement = useCallback(
    (el: HTMLImageElement | null) => {
      if (el?.complete) applyNaturalSize(el);
    },
    [applyNaturalSize],
  );

  const hoverPopSize = useMemo(
    () =>
      naturalSize
        ? fitHoverPreviewBox(naturalSize.w, naturalSize.h, REF_HOVER_PREVIEW_MAX_PX)
        : { width: 200, height: 150 },
    [naturalSize],
  );

  const hoverMediaStyle = useMemo(
    () =>
      ({
        width: hoverPopSize.width,
        height: hoverPopSize.height,
        objectFit: "contain",
        objectPosition: "center",
        display: "block",
      }) as const,
    [hoverPopSize.height, hoverPopSize.width],
  );

  if (item.kind === "text" || item.kind === "audio") return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="mmThumbHoverPop mmThumbHoverPop--solo nodrag nopan nowheel"
      style={{
        left: anchorRect.left + anchorRect.width / 2,
        top: anchorRect.top,
      }}
      onMouseEnter={onPointerEnter}
      onMouseLeave={onPointerLeave}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className="mmThumbHoverPopMedia mmThumbHoverPopMedia--natural"
        style={{ width: hoverPopSize.width, height: hoverPopSize.height }}
      >
        {item.kind === "image" ? (
          <NodeMediaPreview
            relPath={item.path}
            assetId={item.assetId}
            kind="image"
            imageClassName="mmThumbHoverPopImg"
            imageStyle={hoverMediaStyle}
            imageLoading="eager"
            onImageElement={handleImageElement}
            onImageLoad={(e) => applyNaturalSize(e.currentTarget)}
          />
        ) : (
          <NodeMediaPreview
            relPath={item.path}
            assetId={item.assetId}
            kind="video"
            videoClassName="mmThumbHoverPopImg"
            videoStyle={hoverMediaStyle}
            videoControls={false}
            videoAutoPlay
            videoLoop
            onVideoLoadedMetadata={(e) => applyNaturalSize(e.currentTarget)}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}
