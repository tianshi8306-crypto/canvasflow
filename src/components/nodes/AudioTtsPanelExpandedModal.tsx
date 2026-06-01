import { useEffect, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { AudioTtsPanel } from "@/components/nodes/AudioTtsPanel";
import { NODE_CHROME_AUDIO_PANEL_CLASS } from "@/components/nodes/nodeChrome";
import { GEN_PANEL_CHROME_WIDTH } from "@/hooks/useNodeGenerationChrome";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";
import "./ImageGenerationPanelExpandedModal.css";
import "./AudioNodeChrome.css";

const EXPANDED_Z = 55;

/** 音频节点 TTS 面板放大态（底栏宽与图片 IGP 一致 500px） */
export function AudioTtsPanelExpandedModal() {
  const expandedNodeId = useCanvasUiStore((s) => s.audioTtsPanelExpandedNodeId);
  const setExpandedNodeId = useCanvasUiStore((s) => s.setAudioTtsPanelExpandedNodeId);
  const setPinnedNodeId = useCanvasUiStore((s) => s.setAudioTtsPanelPinnedNodeId);
  const setOpenedNodeId = useCanvasUiStore((s) => s.setAudioTtsPanelNodeId);
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

  if (!expandedNodeId || node?.type !== "audioNode" || typeof document === "undefined") {
    return null;
  }

  const close = () => setExpandedNodeId(null);
  const dockToNode = () => {
    setPinnedNodeId(expandedNodeId);
    setOpenedNodeId(expandedNodeId);
    setExpandedNodeId(null);
  };

  return createPortal(
    <div
      className="igp-expanded-overlay atp-expanded-overlay"
      role="dialog"
      aria-modal
      aria-label="文字转语音"
      style={{ zIndex: EXPANDED_Z }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className={`igp-expanded-card atp-expanded-card ${NODE_CHROME_AUDIO_PANEL_CLASS} atp-layout-expanded`}
        style={
          { ["--atp-shell-width" as string]: `${GEN_PANEL_CHROME_WIDTH}px` } as CSSProperties
        }
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="igp-expanded-modal-body">
          <AudioTtsPanel
            nodeId={expandedNodeId}
            onRequestClose={close}
            onRequestDock={dockToNode}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
