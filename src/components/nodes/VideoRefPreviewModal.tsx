import { useState } from "react";
import type { VideoIncomingRefItem } from "@/hooks/useVideoIncomingReferenceItems";
import { NodeMediaPreview } from "@/components/nodes/NodeMediaPreview";

type Props = {
  items: VideoIncomingRefItem[];
  initialIndex: number;
  onClose: () => void;
};

export function VideoRefPreviewModal({ items, initialIndex, onClose }: Props) {
  const [activeIdx, setActiveIdx] = useState(initialIndex);
  const item = items[activeIdx];
  if (!item) return null;

  return (
    <div
      className="mmPreviewOverlay"
      onClick={onClose}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="mmPreviewModal" onClick={(e) => e.stopPropagation()}>
        <div className="mmPreviewHeader">
          <span className="mmPreviewTitle">
            参考图 {activeIdx + 1} / {items.length}
          </span>
          <button type="button" className="mmPreviewClose" onClick={onClose} aria-label="关闭预览">
            ×
          </button>
        </div>

        <div className="mmPreviewBody">
          {item.kind === "image" ? (
            <NodeMediaPreview relPath={item.path} assetId={item.assetId} kind="image" />
          ) : null}
          {item.kind === "video" ? (
            <NodeMediaPreview relPath={item.path} assetId={item.assetId} kind="video" />
          ) : null}
          {item.kind === "audio" ? (
            <div className="mmPreviewAudio">
              <span>♪</span>
              <span>音频参考</span>
            </div>
          ) : null}
        </div>

        {items.length > 1 ? (
          <div className="mmPreviewNav">
            {items.map((it, i) => (
              <button
                key={i}
                type="button"
                className={`mmPreviewNavThumb ${i === activeIdx ? "mmPreviewNavThumb--active" : ""}`}
                onClick={() => setActiveIdx(i)}
                aria-label={`查看第 ${i + 1} 张`}
              >
                <NodeMediaPreview
                  relPath={it.path}
                  assetId={it.assetId}
                  kind={it.kind === "video" ? "video" : "image"}
                />
                <span className="mmPreviewNavBadge">{i + 1}</span>
              </button>
            ))}
          </div>
        ) : null}

        {items.length > 1 ? (
          <>
            <button
              type="button"
              className="mmPreviewArrow mmPreviewArrow--prev"
              onClick={() => setActiveIdx((i) => (i - 1 + items.length) % items.length)}
              disabled={activeIdx === 0}
              aria-label="上一张"
            >
              ‹
            </button>
            <button
              type="button"
              className="mmPreviewArrow mmPreviewArrow--next"
              onClick={() => setActiveIdx((i) => (i + 1) % items.length)}
              disabled={activeIdx === items.length - 1}
              aria-label="下一张"
            >
              ›
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
