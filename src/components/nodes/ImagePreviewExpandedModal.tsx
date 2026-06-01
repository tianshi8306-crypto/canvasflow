import { useEffect } from "react";
import { createPortal } from "react-dom";
import { NodeMediaPreview } from "@/components/nodes/NodeMediaPreview";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";
import "./ImagePreviewExpandedModal.css";

const PREVIEW_EXPANDED_Z = 55;

/** 图片节点预览放大态：LibTV 式居中 lightbox，展示成片大图 */
export function ImagePreviewExpandedModal() {
  const expandedNodeId = useCanvasUiStore((s) => s.imagePreviewExpandedNodeId);
  const setExpandedNodeId = useCanvasUiStore((s) => s.setImagePreviewExpandedNodeId);
  const nodes = useProjectStore((s) => s.nodes);

  const node = expandedNodeId ? nodes.find((n) => n.id === expandedNodeId) : undefined;
  const mediaPath = node?.data.path?.trim();
  const mediaAssetId = node?.data.assetId?.trim();
  const hasMedia = Boolean(mediaPath || mediaAssetId);
  const label = node?.data.label?.trim() || "图片";

  useEffect(() => {
    if (!expandedNodeId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpandedNodeId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expandedNodeId, setExpandedNodeId]);

  if (
    !expandedNodeId ||
    node?.type !== "imageNode" ||
    !hasMedia ||
    typeof document === "undefined"
  ) {
    return null;
  }

  const close = () => setExpandedNodeId(null);

  return createPortal(
    <div
      className="imagePreviewExpanded-overlay"
      role="dialog"
      aria-modal
      aria-label={`${label} 放大预览`}
      style={{ zIndex: PREVIEW_EXPANDED_Z }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <button
        type="button"
        className="imagePreviewExpanded-close"
        aria-label="关闭"
        title="关闭 (Esc)"
        onClick={close}
      >
        ✕
      </button>
      <div className="imagePreviewExpanded-stage" onPointerDown={(e) => e.stopPropagation()}>
        <NodeMediaPreview
          relPath={mediaPath}
          assetId={mediaAssetId}
          kind="image"
          imageClassName="imagePreviewExpanded-img"
          imageLoading="eager"
        />
      </div>
    </div>,
    document.body,
  );
}
