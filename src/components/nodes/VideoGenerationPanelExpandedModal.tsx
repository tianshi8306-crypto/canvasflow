import { useEffect } from "react";
import { createPortal } from "react-dom";
import { NODE_CHROME_VIDEO_PANEL_CLASS } from "@/components/nodes/nodeChrome";
import { VideoMultimodalInputPanel } from "@/components/nodes/VideoMultimodalInputPanel";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";
import "./ImageGenerationPanelExpandedModal.css";

const EXPANDED_Z = 55;

/** 视频生成参数面板放大态（对齐图片节点 ImageGenerationPanelExpandedModal） */
export function VideoGenerationPanelExpandedModal() {
  const expandedNodeId = useCanvasUiStore((s) => s.videoGenPanelExpandedNodeId);
  const setExpandedNodeId = useCanvasUiStore((s) => s.setVideoGenPanelExpandedNodeId);
  const setPinnedNodeId = useCanvasUiStore((s) => s.setVideoGenPanelPinnedNodeId);
  const nodes = useProjectStore((s) => s.nodes);

  const node = expandedNodeId ? nodes.find((n) => n.id === expandedNodeId) : undefined;

  useEffect(() => {
    if (!expandedNodeId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpandedNodeId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expandedNodeId, setExpandedNodeId]);

  if (!expandedNodeId || node?.type !== "videoNode" || typeof document === "undefined") {
    return null;
  }

  const close = () => setExpandedNodeId(null);
  const dockToNode = () => {
    setPinnedNodeId(expandedNodeId);
    setExpandedNodeId(null);
  };

  return createPortal(
    <div
      className="igp-expanded-overlay"
      role="dialog"
      aria-modal
      aria-label="视频生成参数"
      style={{ zIndex: EXPANDED_Z }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className={`igp-expanded-card ${NODE_CHROME_VIDEO_PANEL_CLASS} vgp-layout-expanded`}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="igp-expanded-modal-body">
          <VideoMultimodalInputPanel
            videoNodeId={expandedNodeId}
            layout="expanded"
            onRequestClose={close}
            onRequestDock={dockToNode}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
