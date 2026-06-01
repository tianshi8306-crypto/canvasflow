import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { Node } from "@xyflow/react";
import { useReactFlow, useStore } from "@xyflow/react";
import { viewportFlowRectFromPane } from "@/lib/canvasViewportVisibility";
import { useProjectStore } from "@/store/projectStore";

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 3;
const SHOW_DELAY_MS = 280;

type Props = {
  wrapRef: RefObject<HTMLDivElement | null>;
  nodeCount: number;
};

/**
 * 画布有节点但当前视窗内看不到任何节点时，顶部显示「回到节点」条。
 */
export function CanvasReturnToWorkBanner({ wrapRef, nodeCount }: Props) {
  const { screenToFlowPosition, getIntersectingNodes, fitView, getViewport } = useReactFlow();
  const commitViewport = useProjectStore((s) => s.commitViewport);
  const nodes = useProjectStore((s) => s.nodes);
  const transform = useStore((s) => s.transform);
  const [visible, setVisible] = useState(false);
  const showTimerRef = useRef<number | undefined>(undefined);

  const hasNodesInView = useCallback(() => {
    if (nodeCount === 0) return true;
    const pane = wrapRef.current?.querySelector(".react-flow__pane");
    if (!pane) return true;
    const rect = pane.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return true;
    const viewRect = viewportFlowRectFromPane(rect, screenToFlowPosition);
    const hit = getIntersectingNodes(viewRect, true, nodes as Node[]);
    return hit.length > 0;
  }, [nodeCount, wrapRef, screenToFlowPosition, getIntersectingNodes, nodes]);

  useEffect(() => {
    if (showTimerRef.current !== undefined) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = undefined;
    }

    if (nodeCount === 0) {
      setVisible(false);
      return;
    }

    if (hasNodesInView()) {
      setVisible(false);
      return;
    }

    showTimerRef.current = window.setTimeout(() => {
      showTimerRef.current = undefined;
      if (nodeCount > 0 && !hasNodesInView()) {
        setVisible(true);
      }
    }, SHOW_DELAY_MS);

    return () => {
      if (showTimerRef.current !== undefined) {
        window.clearTimeout(showTimerRef.current);
      }
    };
  }, [nodeCount, nodes, transform, hasNodesInView]);

  const handleReturn = useCallback(() => {
    void (async () => {
      try {
        await fitView({
          padding: 0.12,
          duration: 320,
          minZoom: MIN_ZOOM,
          maxZoom: MAX_ZOOM,
        });
      } catch {
        /* 极端视口下 fitView 可能失败 */
      }
      commitViewport(getViewport());
      setVisible(false);
    })();
  }, [commitViewport, fitView, getViewport]);

  if (!visible) return null;

  return (
    <div className="canvasReturnToWork" role="status" aria-live="polite">
      <p className="canvasReturnToWork__text">当前视窗没有节点，可点击按钮快速回到内容区域</p>
      <button type="button" className="canvasReturnToWork__btn" onClick={handleReturn}>
        回到节点
      </button>
    </div>
  );
}
