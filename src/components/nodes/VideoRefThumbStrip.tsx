import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import {
  preferredVideoNameToken,
  type VideoRefAtMeta,
} from "@/lib/seedance/videoPromptAtTokens";
import type { VideoIncomingRefItem } from "@/hooks/useVideoIncomingReferenceItems";
import { REF_HOVER_PREVIEW_DELAY_MS } from "@/lib/video/refPreviewUtils";
import { useVideoRefStripPointerReorder } from "@/hooks/useVideoRefStripPointerReorder";
import { VideoRefThumbnail } from "@/components/nodes/VideoRefThumbnail";
import { VideoRefThumbHoverPreview } from "@/components/nodes/VideoRefThumbHoverPreview";

type Props = {
  items: VideoIncomingRefItem[];
  refAtMeta: Map<string, VideoRefAtMeta>;
  showFirstLastControls: boolean;
  firstLastImageItems: VideoIncomingRefItem[];
  focusedRefEdgeId: string | null;
  onFocusedRefChange: (edgeId: string) => void;
  onHoveredRefChange: (edgeId: string | null) => void;
  onInsertAtToken: (token: string) => void;
  onPreview: (index: number) => void;
  onDelete: (edgeId: string) => void;
  onReorder: (fromEdgeId: string, toEdgeId: string) => void;
  onSwapFirstLast: () => void;
  thumbElRefs?: MutableRefObject<Map<string, HTMLDivElement>>;
};

/** 视频生成面板参考条（缩略图 + 悬停预览 + 拖拽排序） */
export function VideoRefThumbStrip({
  items,
  refAtMeta,
  showFirstLastControls,
  firstLastImageItems,
  focusedRefEdgeId,
  onFocusedRefChange,
  onHoveredRefChange,
  onInsertAtToken,
  onPreview,
  onDelete,
  onReorder,
  onSwapFirstLast,
  thumbElRefs: externalThumbRefs,
}: Props) {
  const internalThumbElRefs = useRef(new Map<string, HTMLDivElement>());
  const thumbElRefs = externalThumbRefs ?? internalThumbElRefs;
  const reorderSuppressClickRef = useRef(false);
  const hoverPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hoverPreviewEdgeId, setHoverPreviewEdgeId] = useState<string | null>(null);
  const [hoveredRefEdgeId, setHoveredRefEdgeId] = useState<string | null>(null);

  const reorderEnabled = items.length > 1;

  const clearHoverPreviewTimer = useCallback(() => {
    if (hoverPreviewTimerRef.current) {
      clearTimeout(hoverPreviewTimerRef.current);
      hoverPreviewTimerRef.current = null;
    }
  }, []);

  const {
    dragEdgeId: refDragEdgeId,
    dropEdgeId: refDropEdgeId,
    bindThumbPointerDown,
    consumeClickSuppressed: consumeReorderClickSuppressed,
  } = useVideoRefStripPointerReorder({
    enabled: reorderEnabled,
    thumbElRefs,
    onReorder,
    onDragSessionStart: () => {
      clearHoverPreviewTimer();
      setHoverPreviewEdgeId(null);
    },
    suppressClickRef: reorderSuppressClickRef,
  });

  useEffect(() => () => clearHoverPreviewTimer(), [clearHoverPreviewTimer]);

  useEffect(() => {
    const ids = new Set(items.map((t) => t.edgeId));
    if (hoveredRefEdgeId && !ids.has(hoveredRefEdgeId)) setHoveredRefEdgeId(null);
    if (hoverPreviewEdgeId && !ids.has(hoverPreviewEdgeId)) setHoverPreviewEdgeId(null);
  }, [items, hoveredRefEdgeId, hoverPreviewEdgeId]);

  useEffect(() => {
    onHoveredRefChange(hoveredRefEdgeId);
  }, [hoveredRefEdgeId, onHoveredRefChange]);

  const openHoverPreview = useCallback(
    (edgeId: string) => {
      const item = items.find((t) => t.edgeId === edgeId);
      if (!item) return;
      if (item.kind === "audio") {
        setHoveredRefEdgeId((cur) => (cur === edgeId ? cur : edgeId));
        return;
      }
      setHoverPreviewEdgeId((cur) => (cur === edgeId ? cur : edgeId));
      setHoveredRefEdgeId((cur) => (cur === edgeId ? cur : edgeId));
    },
    [items],
  );

  const scheduleHoverPreview = useCallback(
    (edgeId: string) => {
      clearHoverPreviewTimer();
      hoverPreviewTimerRef.current = setTimeout(
        () => openHoverPreview(edgeId),
        REF_HOVER_PREVIEW_DELAY_MS,
      );
    },
    [clearHoverPreviewTimer, openHoverPreview],
  );

  const closeHoverPreview = useCallback(() => {
    clearHoverPreviewTimer();
    setHoverPreviewEdgeId(null);
    setHoveredRefEdgeId(focusedRefEdgeId);
  }, [clearHoverPreviewTimer, focusedRefEdgeId]);

  const activeRefEdgeId = focusedRefEdgeId ?? hoveredRefEdgeId;

  const hoverPreviewItem = useMemo(
    () =>
      hoverPreviewEdgeId ? items.find((t) => t.edgeId === hoverPreviewEdgeId) ?? null : null,
    [hoverPreviewEdgeId, items],
  );

  const hoverPreviewAnchor =
    hoverPreviewEdgeId != null
      ? thumbElRefs.current.get(hoverPreviewEdgeId)?.getBoundingClientRect() ?? null
      : null;

  const handleHoverPopPointerEnter = useCallback(() => {
    if (hoverPreviewEdgeId) openHoverPreview(hoverPreviewEdgeId);
  }, [hoverPreviewEdgeId, openHoverPreview]);

  if (items.length === 0) return null;

  return (
    <>
      <div className="mmThumbsWrapper">
        {showFirstLastControls ? (
          <button
            type="button"
            className="mmSwapFirstLast"
            title="交换首帧与尾帧（调整源节点顺序）"
            onClick={onSwapFirstLast}
          >
            交换首尾
          </button>
        ) : null}
        <div className="mmThumbsScrollZone">
          <div className="mmThumbs">
            {items.map((item, idx) => {
              const meta = refAtMeta.get(item.edgeId);
              const frameIdx = firstLastImageItems.findIndex((t) => t.edgeId === item.edgeId);
              const frameBadge =
                showFirstLastControls && item.kind === "image" && frameIdx >= 0
                  ? frameIdx === 0
                    ? "首帧"
                    : "尾帧"
                  : undefined;
              return (
                <VideoRefThumbnail
                  key={item.edgeId}
                  badgeLabel={frameBadge ?? meta?.badge ?? String(idx + 1)}
                  atToken={meta?.token}
                  preferredNameToken={meta ? preferredVideoNameToken(meta) : undefined}
                  isSelected={focusedRefEdgeId === item.edgeId}
                  isActive={activeRefEdgeId === item.edgeId}
                  isHoverPreviewActive={hoverPreviewEdgeId === item.edgeId}
                  path={item.path}
                  assetId={item.assetId}
                  kind={item.kind}
                  nodeLabel={item.nodeLabel}
                  textContent={item.textContent}
                  hasAudioDialogue={item.hasAudioDialogue}
                  edgeId={item.edgeId}
                  useFocusLoop
                  thumbRef={(el) => {
                    if (el) thumbElRefs.current.set(item.edgeId, el);
                    else thumbElRefs.current.delete(item.edgeId);
                  }}
                  onSelect={() => onFocusedRefChange(item.edgeId)}
                  onHoverStart={() => scheduleHoverPreview(item.edgeId)}
                  onHoverEnd={closeHoverPreview}
                  onInsertAtToken={onInsertAtToken}
                  onPreview={() => onPreview(idx)}
                  onDelete={onDelete}
                  reorderEnabled={reorderEnabled}
                  isReorderDragging={refDragEdgeId === item.edgeId}
                  isReorderDropTarget={
                    refDropEdgeId === item.edgeId && refDragEdgeId !== item.edgeId
                  }
                  onReorderPointerDown={bindThumbPointerDown(item.edgeId)}
                  consumeReorderClickSuppressed={consumeReorderClickSuppressed}
                />
              );
            })}
          </div>
        </div>
      </div>

      {hoverPreviewItem && hoverPreviewAnchor ? (
        <VideoRefThumbHoverPreview
          item={hoverPreviewItem}
          anchorRect={hoverPreviewAnchor}
          onPointerEnter={handleHoverPopPointerEnter}
          onPointerLeave={closeHoverPreview}
        />
      ) : null}
    </>
  );
}
