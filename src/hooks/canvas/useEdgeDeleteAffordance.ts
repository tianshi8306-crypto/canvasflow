import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import type { Edge } from "@xyflow/react";
import type { Node } from "@xyflow/react";
import {
  pointOnEdgeScreenAtRatio,
  projectPointerOnEdge,
} from "@/lib/canvas/edgePathGeometry";
import type { FlowNodeData } from "@/lib/types";

export type EdgeDeleteAffordance = {
  edgeId: string;
  x: number;
  y: number;
};

type Args = {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  selectedEdgeIds: string[];
  flowToScreenPosition: (p: { x: number; y: number }) => { x: number; y: number };
  viewport: { x: number; y: number; zoom: number };
};

export function useEdgeDeleteAffordance({
  nodes,
  edges,
  selectedEdgeIds,
  flowToScreenPosition,
  viewport,
}: Args) {
  const [affordance, setAffordance] = useState<EdgeDeleteAffordance | null>(null);
  /** 仅由 onEdgeClick 写入：点击处在路径上的比例，用于平移/缩放后重算位置 */
  const pinnedPathRef = useRef<{ edgeId: string; pathT: number } | null>(null);

  const singleSelectedEdgeId =
    selectedEdgeIds.length === 1 ? selectedEdgeIds[0]! : null;

  const selectedEdge = useMemo(
    () => (singleSelectedEdgeId ? edges.find((e) => e.id === singleSelectedEdgeId) : null),
    [edges, singleSelectedEdgeId],
  );

  const resolveEdgeNodes = useCallback(
    (edge: Edge) => ({
      source: nodes.find((n) => n.id === edge.source),
      target: nodes.find((n) => n.id === edge.target),
    }),
    [nodes],
  );

  const syncAffordanceAtPathT = useCallback(
    (edge: Edge, pathT: number) => {
      const { source, target } = resolveEdgeNodes(edge);
      const pt = pointOnEdgeScreenAtRatio(source, target, flowToScreenPosition, pathT);
      if (!pt) {
        setAffordance(null);
        return;
      }
      setAffordance({ edgeId: edge.id, x: pt.x, y: pt.y });
    },
    [flowToScreenPosition, resolveEdgeNodes],
  );

  const clearAffordance = useCallback(() => {
    pinnedPathRef.current = null;
    setAffordance(null);
  }, []);

  /** 平移/缩放/节点移动：按点选时钉住的 pathT 重算屏幕坐标（勿在无 pin 时回退中点） */
  useEffect(() => {
    if (!selectedEdge) {
      pinnedPathRef.current = null;
      setAffordance(null);
      return;
    }
    const pin = pinnedPathRef.current;
    if (!pin || pin.edgeId !== selectedEdge.id) {
      setAffordance(null);
      return;
    }
    syncAffordanceAtPathT(selectedEdge, pin.pathT);
  }, [selectedEdge, syncAffordanceAtPathT, viewport.x, viewport.y, viewport.zoom, nodes]);

  const onEdgeClick = useCallback(
    (ev: MouseEvent, edge: Edge) => {
      const { source, target } = resolveEdgeNodes(edge);
      const hit = projectPointerOnEdge(
        source,
        target,
        ev.clientX,
        ev.clientY,
        flowToScreenPosition,
      );
      if (!hit) {
        pinnedPathRef.current = null;
        setAffordance(null);
        return;
      }
      pinnedPathRef.current = { edgeId: edge.id, pathT: hit.pathT };
      setAffordance({ edgeId: edge.id, x: hit.x, y: hit.y });
    },
    [flowToScreenPosition, resolveEdgeNodes],
  );

  return {
    affordance,
    onEdgeClick,
    clearAffordance,
  };
}
