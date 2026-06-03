import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type RefCallback,
} from "react";
import { createPortal } from "react-dom";
import { NodeMediaPreview } from "@/components/nodes/NodeMediaPreview";
import { isEdgeDisabled } from "@/lib/edgeState";
import type { ResolvedIncomingImagePanelRef } from "@/lib/imageGeneration/types";
import { imageRefAtToken, imageTextRefAtToken } from "@/lib/imageGeneration/imagePromptAtTokens";
import { videoRefTextThumbExcerpt } from "@/lib/videoRefTextThumbExcerpt";
import {
  fitHoverPreviewBox,
  readMediaNaturalSize,
  REF_HOVER_PREVIEW_DELAY_MS,
  REF_HOVER_PREVIEW_MAX_PX,
} from "@/lib/video/refPreviewUtils";
import { useVideoRefStripPointerReorder } from "@/hooks/useVideoRefStripPointerReorder";
import { useProjectStore } from "@/store/projectStore";

type Props = {
  targetNodeId: string;
  items: ResolvedIncomingImagePanelRef[];
  activeSourceNodeId?: string | null;
  onSelect?: (sourceNodeId: string) => void;
  onInsertAtToken?: (token: string) => void;
  onHoverStart?: (sourceNodeId: string) => void;
  onHoverEnd?: () => void;
  onReorder?: (fromEdgeId: string, toEdgeId: string) => void;
  thumbElRefs?: MutableRefObject<Map<string, HTMLDivElement>>;
};

function imageSlotBeforeIndex(items: ResolvedIncomingImagePanelRef[], idx: number): number {
  return items.slice(0, idx).filter((i) => i.kind === "image").length + 1;
}

/** 查找连入目标图片节点的上游参考边（用于删除） */
export function findIncomingImageRefEdge(
  edges: { id: string; source: string; target: string; targetHandle?: string | null }[],
  targetNodeId: string,
  sourceNodeId: string,
): string | null {
  const edge = edges.find(
    (e) =>
      !isEdgeDisabled(e as Parameters<typeof isEdgeDisabled>[0]) &&
      e.target === targetNodeId &&
      e.source === sourceNodeId &&
      (!e.targetHandle || e.targetHandle === "in"),
  );
  return edge?.id ?? null;
}

function ImageRefThumbHoverPreview({
  item,
  anchorRect,
  onPointerEnter,
  onPointerLeave,
}: {
  item: Extract<ResolvedIncomingImagePanelRef, { kind: "image" }>;
  anchorRect: DOMRect;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const mediaKey = `${item.sourceNodeId}:${item.assetId ?? ""}:${item.path ?? ""}`;

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

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="igpRefStrip-hoverPop nodrag nopan nowheel"
      style={{
        left: anchorRect.left + anchorRect.width / 2,
        top: anchorRect.top,
      }}
      onMouseEnter={onPointerEnter}
      onMouseLeave={onPointerLeave}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className="igpRefStrip-hoverPopMedia"
        style={{ width: hoverPopSize.width, height: hoverPopSize.height }}
      >
        <NodeMediaPreview
          relPath={item.path ?? item.resolvedPath}
          assetId={item.assetId}
          kind="image"
          imageClassName="igpRefStrip-hoverPopImg"
          imageStyle={hoverMediaStyle}
          imageLoading="eager"
          onImageElement={handleImageElement}
          onImageLoad={(e) => applyNaturalSize(e.currentTarget)}
        />
      </div>
    </div>,
    document.body,
  );
}

/** 图片生成面板参考条（图片预览 + 上游文本，与 VGP 参考条对齐） */
export function ImageRefThumbStrip({
  targetNodeId,
  items,
  activeSourceNodeId,
  onSelect,
  onInsertAtToken,
  onHoverStart,
  onHoverEnd,
  onReorder,
  thumbElRefs: externalThumbRefs,
}: Props) {
  const deleteEdge = useProjectStore((s) => s.deleteEdge);
  const edges = useProjectStore((s) => s.edges);

  const internalThumbElRefs = useRef(new Map<string, HTMLDivElement>());
  const thumbElRefs = externalThumbRefs ?? internalThumbElRefs;
  const reorderSuppressClickRef = useRef(false);
  const hoverPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hoverPreviewEdgeId, setHoverPreviewEdgeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  const reorderEnabled = items.length > 1 && Boolean(onReorder);

  const clearHoverPreviewTimer = useCallback(() => {
    if (hoverPreviewTimerRef.current != null) {
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
    onReorder: onReorder ?? (() => {}),
    onDragSessionStart: () => {
      clearHoverPreviewTimer();
      setHoverPreviewEdgeId(null);
    },
    suppressClickRef: reorderSuppressClickRef,
  });

  useEffect(() => () => clearHoverPreviewTimer(), [clearHoverPreviewTimer]);

  useEffect(() => {
    const ids = new Set(items.map((i) => i.edgeId));
    if (hoverPreviewEdgeId && !ids.has(hoverPreviewEdgeId)) setHoverPreviewEdgeId(null);
    if (hoveredEdgeId && !ids.has(hoveredEdgeId)) setHoveredEdgeId(null);
  }, [hoverPreviewEdgeId, hoveredEdgeId, items]);

  const openHoverPreview = useCallback(
    (edgeId: string) => {
      const item = items.find((i) => i.edgeId === edgeId);
      if (!item || item.kind !== "image") return;
      setHoverPreviewEdgeId(edgeId);
      setHoveredEdgeId(edgeId);
      onHoverStart?.(item.sourceNodeId);
    },
    [items, onHoverStart],
  );

  const scheduleHoverPreview = useCallback(
    (edgeId: string) => {
      const item = items.find((i) => i.edgeId === edgeId);
      if (item?.kind === "text") {
        setHoveredEdgeId(edgeId);
        onHoverStart?.(item.sourceNodeId);
        return;
      }
      clearHoverPreviewTimer();
      hoverPreviewTimerRef.current = setTimeout(
        () => openHoverPreview(edgeId),
        REF_HOVER_PREVIEW_DELAY_MS,
      );
    },
    [clearHoverPreviewTimer, items, onHoverStart, openHoverPreview],
  );

  const closeHoverPreview = useCallback(() => {
    clearHoverPreviewTimer();
    setHoverPreviewEdgeId(null);
    setHoveredEdgeId(null);
    onHoverEnd?.();
  }, [clearHoverPreviewTimer, onHoverEnd]);

  const hoverPreviewItem = useMemo(
    () =>
      hoverPreviewEdgeId
        ? items.find((i) => i.edgeId === hoverPreviewEdgeId) ?? null
        : null,
    [hoverPreviewEdgeId, items],
  );

  const hoverPreviewImageItem =
    hoverPreviewItem?.kind === "image" ? hoverPreviewItem : null;

  const hoverPreviewAnchor =
    hoverPreviewEdgeId != null
      ? thumbElRefs.current.get(hoverPreviewEdgeId)?.getBoundingClientRect() ?? null
      : null;

  const setThumbRef = useCallback(
    (edgeId: string): RefCallback<HTMLDivElement> =>
      (el) => {
        if (el) thumbElRefs.current.set(edgeId, el);
        else thumbElRefs.current.delete(edgeId);
      },
    [thumbElRefs],
  );

  const handleDelete = useCallback(
    (sourceNodeId: string) => {
      const edgeId = findIncomingImageRefEdge(edges, targetNodeId, sourceNodeId);
      if (edgeId) deleteEdge(edgeId);
    },
    [deleteEdge, edges, targetNodeId],
  );

  if (items.length === 0) return null;

  return (
    <div className="igpRefStrip nodrag nopan nowheel" onPointerDown={(e) => e.stopPropagation()}>
      <div className="igpRefStrip-scrollZone">
        <div className="igpRefStrip-thumbs">
          {items.map((item, idx) => {
            const edgeId = item.edgeId;
            const sourceId = item.sourceNodeId;
            const isText = item.kind === "text";
            const isHovered =
              hoveredEdgeId === edgeId ||
              (hoverPreviewEdgeId === edgeId && !isText);
            const isActive = activeSourceNodeId === sourceId;
            const isReorderDragging = refDragEdgeId === edgeId;
            const isReorderDropTarget = refDropEdgeId === edgeId;
            const badge = String(idx + 1);
            const imageAtToken = isText
              ? undefined
              : imageRefAtToken(imageSlotBeforeIndex(items, idx));
            const insertToken = isText ? imageTextRefAtToken(idx + 1) : imageAtToken;
            const title = isText
              ? `${item.nodeLabel} · 拖动换位 · Shift+单击插入 ${insertToken} · 点击 × 移除连线`
              : `参考图 ${badge} · 拖动换位 · 单击选中 · Shift+单击插入 ${imageAtToken} · 悬停预览 · 点击 × 移除连线`;
            const textExcerpt = isText ? videoRefTextThumbExcerpt(item.textContent) : "";
            return (
              <div
                key={edgeId}
                ref={setThumbRef(edgeId)}
                className={`igpRefStrip-thumb nodrag nopan nowheel${isText ? " igpRefStrip-thumb--text" : ""}${isHovered ? " is-hovered" : ""}${isActive ? " is-selected" : ""}${
                  isReorderDragging ? " igpRefStrip-thumb--reorder-dragging" : ""
                }${isReorderDropTarget ? " igpRefStrip-thumb--reorder-drop" : ""}${
                  reorderEnabled ? " igpRefStrip-thumb--reorderable" : ""
                }`}
                title={title}
                onDragStart={(e) => e.preventDefault()}
                onPointerDown={reorderEnabled ? bindThumbPointerDown(edgeId) : undefined}
                onMouseEnter={() => scheduleHoverPreview(edgeId)}
                onMouseLeave={closeHoverPreview}
                onClick={(e) => {
                  e.stopPropagation();
                  if (consumeReorderClickSuppressed()) return;
                  if (e.shiftKey && insertToken) {
                    onInsertAtToken?.(insertToken);
                    return;
                  }
                  onSelect?.(sourceId);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (e.shiftKey && insertToken) onInsertAtToken?.(insertToken);
                    else onSelect?.(sourceId);
                  }
                }}
                aria-label={isText ? `上游文本 ${item.nodeLabel}` : `参考图 ${badge}`}
                aria-pressed={isActive}
              >
                <span className="igpRefStrip-badge">{badge}</span>
                <button
                  type="button"
                  className="igpRefStrip-delete"
                  title="移除参考连线"
                  aria-label={`删除${isText ? "文本" : "参考图"} ${badge} 的连线`}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(sourceId);
                  }}
                >
                  ×
                </button>
                <div
                  className={`igpRefStrip-thumbInner${isText ? " igpRefStrip-thumbInner--text" : ""}`}
                >
                  {isText ? (
                    <div className="igpRefStrip-textMicro" aria-hidden>
                      {textExcerpt ? (
                        <div className="igpRefStrip-textMicro-inner">{textExcerpt}</div>
                      ) : (
                        <span className="igpRefStrip-textMicro-empty">空</span>
                      )}
                    </div>
                  ) : (
                    <NodeMediaPreview
                      relPath={item.path ?? item.resolvedPath}
                      assetId={item.assetId}
                      kind="image"
                      imageClassName="igpRefStrip-thumbImg"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {hoverPreviewImageItem && hoverPreviewAnchor ? (
        <ImageRefThumbHoverPreview
          item={hoverPreviewImageItem}
          anchorRect={hoverPreviewAnchor}
          onPointerEnter={() => {
            if (hoverPreviewEdgeId) openHoverPreview(hoverPreviewEdgeId);
          }}
          onPointerLeave={closeHoverPreview}
        />
      ) : null}
    </div>
  );
}
