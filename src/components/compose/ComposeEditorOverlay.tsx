/**
 * 视频合成全屏剪辑工作台
 */
import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { ComposeEditorBody } from "@/components/compose/ComposeEditorBody";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";
import "./ComposeEditorOverlay.css";
import "./composeEditorTimeline21.css";

export function ComposeEditorOverlay() {
  const nodeId = useCanvasUiStore((s) => s.composeEditorNodeId);
  const setComposeEditorNodeId = useCanvasUiStore((s) => s.setComposeEditorNodeId);
  const nodes = useProjectStore((s) => s.nodes);

  const node = useMemo(
    () => nodes.find((n) => n.id === nodeId && n.type === "ffmpegConcat") ?? null,
    [nodes, nodeId],
  );

  useEffect(() => {
    if (nodeId && !node) {
      setComposeEditorNodeId(null);
    }
  }, [nodeId, node, setComposeEditorNodeId]);

  useEffect(() => {
    if (!nodeId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        useCanvasUiStore.getState().requestCanvasFitToNode(nodeId);
        setComposeEditorNodeId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nodeId, setComposeEditorNodeId]);

  if (!nodeId || !node || typeof document === "undefined") {
    return null;
  }

  const title = node.data.label?.trim() || "剪辑";

  return createPortal(
    <div className="composeEditorBackdrop" role="presentation">
      <div
        className="composeEditorShell"
        role="dialog"
        aria-modal="true"
        aria-label="视频剪辑"
        onClick={(e) => e.stopPropagation()}
      >
        <ComposeEditorBody
          nodeId={nodeId}
          title={title}
          onClose={() => {
            useCanvasUiStore.getState().setComposeEditorNodeId(null);
          }}
        />
      </div>
    </div>,
    document.body,
  );
}
