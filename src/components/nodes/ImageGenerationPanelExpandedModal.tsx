import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ImageGenerationPanel } from "@/components/nodes/ImageGenerationPanel";
import { NODE_CHROME_GEN_PANEL_CLASS } from "@/components/nodes/nodeChrome";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";
import "./ImageGenerationPanelExpandedModal.css";

const EXPANDED_Z = 55;

/**
 * 生成参数面板放大态：居中浮层，与底部 Portal 共用同一 ImageGenerationPanel 数据。
 */
export function ImageGenerationPanelExpandedModal() {
  const expandedNodeId = useCanvasUiStore((s) => s.imageGenPanelExpandedNodeId);
  const setExpandedNodeId = useCanvasUiStore((s) => s.setImageGenPanelExpandedNodeId);
  const setPinnedNodeId = useCanvasUiStore((s) => s.setImageGenPanelPinnedNodeId);
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

  if (!expandedNodeId || node?.type !== "imageNode" || typeof document === "undefined") {
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
      aria-label="图片生成参数"
      style={{ zIndex: EXPANDED_Z }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className={`igp-expanded-card ${NODE_CHROME_GEN_PANEL_CLASS} igp-layout-expanded`}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="igp-expanded-modal-body">
          <ImageGenerationPanel
            nodeId={expandedNodeId}
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
