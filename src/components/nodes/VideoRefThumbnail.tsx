import { useCallback, useMemo, type PointerEvent as ReactPointerEvent } from "react";
import { NodeMediaPreview } from "@/components/nodes/NodeMediaPreview";
import {
  VideoRefThumbAudioCenterPlay,
  VideoRefThumbAudioProvider,
} from "@/components/nodes/VideoRefThumbAudioScrub";
import { videoRefTextThumbExcerpt } from "@/lib/videoRefTextThumbExcerpt";
import type { VideoIncomingRefKind } from "@/hooks/useVideoIncomingReferenceItems";

export type VideoRefThumbnailProps = {
  badgeLabel: string;
  atToken?: string;
  preferredNameToken?: string;
  isSelected?: boolean;
  isActive?: boolean;
  isHoverPreviewActive?: boolean;
  path?: string;
  assetId?: string;
  kind: VideoIncomingRefKind;
  nodeLabel: string;
  textContent?: string;
  hasAudioDialogue?: boolean;
  edgeId: string;
  useFocusLoop?: boolean;
  thumbRef?: (el: HTMLDivElement | null) => void;
  onPreview?: () => void;
  onSelect?: () => void;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
  onInsertAtToken?: (token: string) => void;
  onDelete?: (edgeId: string) => void;
  reorderEnabled?: boolean;
  isReorderDragging?: boolean;
  isReorderDropTarget?: boolean;
  onReorderPointerDown?: (e: ReactPointerEvent<HTMLElement>) => void;
  consumeReorderClickSuppressed?: () => boolean;
};

export function VideoRefThumbnail({
  badgeLabel,
  atToken,
  preferredNameToken,
  isSelected = false,
  isActive = false,
  isHoverPreviewActive = false,
  path,
  assetId,
  kind,
  nodeLabel,
  textContent,
  hasAudioDialogue = false,
  edgeId,
  useFocusLoop = false,
  thumbRef,
  onPreview,
  onSelect,
  onHoverStart,
  onHoverEnd,
  onInsertAtToken,
  onDelete,
  reorderEnabled = false,
  isReorderDragging = false,
  isReorderDropTarget = false,
  onReorderPointerDown,
  consumeReorderClickSuppressed,
}: VideoRefThumbnailProps) {
  const setRootRef = useCallback(
    (el: HTMLDivElement | null) => {
      thumbRef?.(el);
    },
    [thumbRef],
  );

  const hasMedia = Boolean(path?.trim() || assetId?.trim());
  const isText = kind === "text";
  const isPendingMedia = !isText && !hasMedia;

  const textExcerpt = useMemo(
    () => (isText ? videoRefTextThumbExcerpt(textContent) : ""),
    [isText, textContent],
  );

  const title = isText
    ? "拖动换位 · Shift+单击插入 @"
    : isPendingMedia
      ? `${nodeLabel}（待出片）`
      : kind === "audio"
        ? `${nodeLabel}${hasAudioDialogue ? " · 含台词" : ""} · 拖动换位 · 单击播放`
        : useFocusLoop
          ? atToken
            ? `拖动换位 · 单击选中 · Shift+单击插入 ${atToken} · 双击全屏`
            : "拖动换位 · 单击选中，双击全屏"
          : atToken
            ? `拖动换位 · 单击插入 ${atToken}${
                preferredNameToken && preferredNameToken !== atToken
                  ? `，Shift+单击 ${preferredNameToken}`
                  : ""
              }，双击全屏预览`
            : "拖动换位 · 双击全屏预览，悬停查看大图";

  const thumbEl = (
    <div
      ref={setRootRef}
      className={`mmThumb mmThumb--clickable mmThumb--${kind}${
        isSelected || isActive ? " mmThumb--selected" : ""
      }${isHoverPreviewActive ? " mmThumb--hovered" : ""}${isPendingMedia ? " mmThumb--pending" : ""}${
        isReorderDragging ? " mmThumb--reorder-dragging" : ""
      }${isReorderDropTarget ? " mmThumb--reorder-drop" : ""}${
        reorderEnabled ? " mmThumb--reorderable" : ""
      }`}
      data-ref-edge-id={edgeId}
      title={title}
      onPointerDown={(e) => {
        if (!reorderEnabled) return;
        onReorderPointerDown?.(e);
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (consumeReorderClickSuppressed?.()) return;
        if (useFocusLoop) {
          if (e.shiftKey) {
            if (preferredNameToken && onInsertAtToken) onInsertAtToken(preferredNameToken);
            else if (atToken && onInsertAtToken) onInsertAtToken(atToken);
            return;
          }
          onSelect?.();
          return;
        }
        if (!onInsertAtToken) return;
        if (e.shiftKey && preferredNameToken) onInsertAtToken(preferredNameToken);
        else if (atToken) onInsertAtToken(atToken);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (hasMedia && !isText) onPreview?.();
      }}
      onMouseEnter={() => {
        if (!isText && hasMedia && kind !== "audio") onHoverStart?.();
      }}
      onMouseLeave={() => onHoverEnd?.()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (useFocusLoop) {
            if (e.shiftKey) {
              if (preferredNameToken && onInsertAtToken) onInsertAtToken(preferredNameToken);
              else if (atToken && onInsertAtToken) onInsertAtToken(atToken);
            } else onSelect?.();
          } else if (atToken && onInsertAtToken) {
            onInsertAtToken(e.shiftKey && preferredNameToken ? preferredNameToken : atToken);
          } else onPreview?.();
        }
      }}
    >
      <span className="mmThumbBadge">{badgeLabel}</span>
      <button
        type="button"
        className="mmThumbDelete"
        title="移除参考连线"
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        onClick={(e) => {
          e.stopPropagation();
          onDelete?.(edgeId);
        }}
        aria-label={`删除参考 ${badgeLabel} 的连线`}
      >
        ×
      </button>
      <div className="mmThumbInner">
        {isText ? (
          <div className="mmThumbTextMicro" aria-hidden>
            {textExcerpt ? (
              <div className="mmThumbTextMicro-inner">{textExcerpt}</div>
            ) : (
              <span className="mmThumbTextMicro-empty">空</span>
            )}
          </div>
        ) : null}
        {isPendingMedia && kind !== "audio" ? (
          <div className="mmThumbPendingIcon" aria-hidden>
            {kind === "video" ? "▶" : "图"}
          </div>
        ) : null}
        {hasMedia && kind === "image" ? (
          <NodeMediaPreview relPath={path} assetId={assetId} kind="image" imageClassName="mmThumbImg" />
        ) : null}
        {hasMedia && kind === "video" ? (
          <NodeMediaPreview
            relPath={path}
            assetId={assetId}
            kind="video"
            videoClassName="mmThumbImg"
            videoControls={false}
            videoAutoPlay
            videoLoop
          />
        ) : null}
        {kind === "audio" && (isPendingMedia || hasMedia) ? (
          <div className="mmThumbAudioGlyph">
            <VideoRefThumbAudioCenterPlay disabled={isPendingMedia} />
          </div>
        ) : null}
      </div>
    </div>
  );

  if (kind === "audio") {
    return (
      <VideoRefThumbAudioProvider relPath={path} assetId={assetId}>
        {thumbEl}
      </VideoRefThumbAudioProvider>
    );
  }

  return thumbEl;
}
