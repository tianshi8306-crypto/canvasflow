import { useEffect, useMemo, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  TextComposerPanel,
  type TextComposerPanelLayout,
} from "@/components/nodes/TextComposerPanel";
import { NODE_CHROME_TEXT_PANEL_CLASS } from "@/components/nodes/nodeChrome";
import { GEN_PANEL_CHROME_WIDTH } from "@/hooks/useNodeGenerationChrome";
import type { TextWorkflowKind } from "@/lib/types";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";
import "./ImageGenerationPanelExpandedModal.css";
import "./TextNodeChrome.css";

const EXPANDED_Z = 55;

function layoutForWorkflow(workflow: TextWorkflowKind | undefined): TextComposerPanelLayout {
  if (workflow === "imageToPrompt") return "imageToPrompt";
  if (workflow === "textToMusic") return "textToMusic";
  return "expanded";
}

/** 文本节点模型对话面板放大态（底栏宽与图片 IGP 一致 500px） */
export function TextComposerPanelExpandedModal() {
  const expandedNodeId = useCanvasUiStore((s) => s.textGenPanelExpandedNodeId);
  const setExpandedNodeId = useCanvasUiStore((s) => s.setTextGenPanelExpandedNodeId);
  const setPinnedNodeId = useCanvasUiStore((s) => s.setTextGenPanelPinnedNodeId);
  const nodes = useProjectStore((s) => s.nodes);

  const node = expandedNodeId ? nodes.find((n) => n.id === expandedNodeId) : undefined;

  const expandedLayout = useMemo(() => {
    if (!node || node.type !== "textNode") return "expanded" as const;
    const params = node.data.params;
    const workflow =
      params && typeof params === "object"
        ? (params as { textWorkflow?: TextWorkflowKind }).textWorkflow
        : undefined;
    return layoutForWorkflow(workflow);
  }, [node]);

  useEffect(() => {
    if (!expandedNodeId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpandedNodeId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expandedNodeId, setExpandedNodeId]);

  if (!expandedNodeId || node?.type !== "textNode" || typeof document === "undefined") {
    return null;
  }

  const close = () => setExpandedNodeId(null);
  const dockToNode = () => {
    setPinnedNodeId(expandedNodeId);
    setExpandedNodeId(null);
  };

  return createPortal(
    <div
      className="igp-expanded-overlay tgp-expanded-overlay"
      role="dialog"
      aria-modal
      aria-label="文本模型对话"
      style={{ zIndex: EXPANDED_Z }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className={`igp-expanded-card tgp-expanded-card tgp-expanded-shell ${NODE_CHROME_TEXT_PANEL_CLASS} tgp-layout-expanded`}
        style={
          { ["--tgp-shell-width" as string]: `${GEN_PANEL_CHROME_WIDTH}px` } as CSSProperties
        }
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="igp-expanded-modal-body">
          <TextComposerPanel
            nodeId={expandedNodeId}
            layout={expandedLayout}
            onRequestClose={close}
            onRequestDock={dockToNode}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
