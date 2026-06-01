import { useEffect, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ScriptComposerPanel } from "@/components/nodes/ScriptComposerPanel";
import { NODE_CHROME_SCRIPT_PANEL_CLASS } from "@/components/nodes/nodeChrome";
import { GEN_PANEL_CHROME_WIDTH } from "@/hooks/useNodeGenerationChrome";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";
import "./ImageGenerationPanelExpandedModal.css";
import "./TextNodeChrome.css";

const EXPANDED_Z = 55;

/** 脚本节点主题编辑面板放大态 */
export function ScriptComposerPanelExpandedModal() {
  const expandedNodeId = useCanvasUiStore((s) => s.scriptGenPanelExpandedNodeId);
  const setExpandedNodeId = useCanvasUiStore((s) => s.setScriptGenPanelExpandedNodeId);
  const setPinnedNodeId = useCanvasUiStore((s) => s.setScriptGenPanelPinnedNodeId);
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

  if (!expandedNodeId || node?.type !== "scriptNode" || typeof document === "undefined") {
    return null;
  }

  const close = () => setExpandedNodeId(null);
  const dockToNode = () => {
    setPinnedNodeId(expandedNodeId);
    setExpandedNodeId(null);
  };

  return createPortal(
    <div
      className="igp-expanded-overlay tgp-expanded-overlay sgp-expanded-overlay"
      role="dialog"
      aria-modal
      aria-label="脚本主题编辑"
      style={{ zIndex: EXPANDED_Z }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className={`igp-expanded-card tgp-expanded-card tgp-expanded-shell sgp-expanded-card ${NODE_CHROME_SCRIPT_PANEL_CLASS} tgp-layout-expanded`}
        style={
          { ["--tgp-shell-width" as string]: `${GEN_PANEL_CHROME_WIDTH}px` } as CSSProperties
        }
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="igp-expanded-modal-body">
          <ScriptComposerPanel
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
