import { useEffect } from "react";
import { createPortal } from "react-dom";
import { NodeMediaPreview } from "@/components/nodes/NodeMediaPreview";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";
import "./VideoPreviewExpandedModal.css";

const PREVIEW_EXPANDED_Z = 55;

/** 视频节点预览放大态：LibTV 式居中 lightbox */
export function VideoPreviewExpandedModal() {
  const expandedNodeId = useCanvasUiStore((s) => s.videoPreviewExpandedNodeId);
  const setExpandedNodeId = useCanvasUiStore((s) => s.setVideoPreviewExpandedNodeId);
  const nodes = useProjectStore((s) => s.nodes);

  const node = expandedNodeId ? nodes.find((n) => n.id === expandedNodeId) : undefined;
  const mediaPath = node?.data.path?.trim();
  const mediaAssetId = node?.data.assetId?.trim();
  const hasMedia = Boolean(mediaPath || mediaAssetId);
  const label = node?.data.label?.trim() || "视频";

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
    node?.type !== "videoNode" ||
    !hasMedia ||
    typeof document === "undefined"
  ) {
    return null;
  }

  const close = () => setExpandedNodeId(null);

  return createPortal(
    <div
      className="videoPreviewExpanded-overlay"
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
        className="videoPreviewExpanded-close"
        aria-label="关闭"
        title="关闭 (Esc)"
        onClick={close}
      >
        ✕
      </button>
      <div className="videoPreviewExpanded-stage" onPointerDown={(e) => e.stopPropagation()}>
        <NodeMediaPreview
          relPath={mediaPath}
          assetId={mediaAssetId}
          kind="video"
          videoClassName="videoPreviewExpanded-video"
          videoControls
        />
      </div>
    </div>,
    document.body,
  );
}
