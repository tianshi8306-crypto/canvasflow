import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";

/** 标记节点后固定在画布视口顶部的导航条 */
export function MarkerToolbar() {
  const markedNodeId = useCanvasUiStore((s) => s.markedNodeId);
  const setMarkedNodeId = useCanvasUiStore((s) => s.setMarkedNodeId);
  const nodes = useProjectStore((s) => s.nodes);

  const { fitView } = useReactFlow();

  const handleLocate = useCallback(() => {
    if (!markedNodeId) return;
    try {
      const targetNodes = nodes.filter((n) => n.id === markedNodeId);
      if (targetNodes.length > 0) {
        fitView({ nodes: targetNodes, padding: 0.2, duration: 300 });
      }
    } catch {
      // silently ignore
    }
  }, [fitView, markedNodeId, nodes]);

  if (!markedNodeId) return null;

  return (
    <div className="markerToolbar" role="toolbar" aria-label="标记导航">
      <div className="markerToolbarInner">
        <button
          type="button"
          className="markerToolbarBtn"
          onClick={handleLocate}
          title="定位到标记的节点"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
          定位
        </button>
        <span className="markerToolbarSep" aria-hidden />
        <button
          type="button"
          className="markerToolbarBtn markerToolbarBtn--exit"
          onClick={() => setMarkedNodeId(null)}
          title="退出标记"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          退出
        </button>
      </div>
    </div>
  );
}
