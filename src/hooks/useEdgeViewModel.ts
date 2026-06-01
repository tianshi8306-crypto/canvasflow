import { useMemo } from "react";
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import type { NodeRunState } from "@/lib/runNodeState";
import {
  CANVAS_EDGE_STROKE_ACTIVE,
  CANVAS_EDGE_STROKE_DEFAULT,
  CANVAS_EDGE_STROKE_DISABLED,
  CANVAS_EDGE_STROKE_RUNNING,
  CANVAS_EDGE_WIDTH_ACTIVE,
} from "@/lib/canvasColors";
import { isEdgeDisabled } from "@/lib/edgeState";
import { stripEphemeralNodeFields } from "@/lib/reactFlowControlled";

type Args = {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  nodeRunStateById: Record<string, NodeRunState>;
  hermesPulseNodeIds?: ReadonlySet<string>;
};

export function buildEdgeView(
  edges: Edge[],
  selectedEdgeIds: string[],
  nodeRunStateById: Record<string, NodeRunState>,
): Edge[] {
  return edges.map((edge) => {
    const sourceState = nodeRunStateById[edge.source];
    const targetState = nodeRunStateById[edge.target];
    const isSelected = selectedEdgeIds.includes(edge.id);
    const isDisabled = isEdgeDisabled(edge);
    const isFailed = sourceState === "failed" || targetState === "failed";
    const isRunning = sourceState === "running" || targetState === "running";
    const isWarning = !isFailed && !isRunning && (sourceState === "skipped" || targetState === "skipped");
    const className = [
      edge.className ?? "",
      "flowEdgeState",
      isSelected ? "flowEdgeState--selected" : "",
      isDisabled ? "flowEdgeState--disabled" : "",
      isFailed ? "flowEdgeState--failed" : "",
      isRunning ? "flowEdgeState--running" : "",
      isWarning ? "flowEdgeState--warning" : "",
    ]
      .join(" ")
      .trim();
    const style = isDisabled
      ? {
          ...(edge.style ?? {}),
          stroke: CANVAS_EDGE_STROKE_DISABLED,
          strokeWidth: 1.9,
          strokeDasharray: "4 4",
          opacity: 0.72,
        }
      : isFailed
        ? { ...(edge.style ?? {}), stroke: "#d17b7b", strokeWidth: 2.2 }
        : isWarning
          ? { ...(edge.style ?? {}), stroke: "#c9a227", strokeWidth: 2.1, strokeDasharray: "6 4" }
          : isRunning
            ? { ...(edge.style ?? {}), stroke: CANVAS_EDGE_STROKE_RUNNING, strokeWidth: 2.4 }
            : isSelected
              ? {
                  ...(edge.style ?? {}),
                  stroke: CANVAS_EDGE_STROKE_ACTIVE,
                  strokeWidth: CANVAS_EDGE_WIDTH_ACTIVE,
                }
              : {
                  ...(edge.style ?? {}),
                  stroke: edge.style?.stroke ?? CANVAS_EDGE_STROKE_DEFAULT,
                  strokeWidth: edge.style?.strokeWidth ?? 2,
                };
    return {
      ...edge,
      selected: isSelected,
      className,
      style,
      animated: isDisabled || isFailed ? false : edge.animated || isRunning,
    };
  });
}

/**
 * 从 store 同步 `selected` 到 RF props，避免内部选区与 selectedNodeIds 不一致触发 onSelectionChange 死循环。
 * onNodesChange 已忽略 type===select，不会把 RF 选区回声写回 store。
 */
export function buildNodesView(
  nodes: Node<FlowNodeData>[],
  selectedNodeIds: string[],
  hermesPulseNodeIds?: ReadonlySet<string>,
): Node<FlowNodeData>[] {
  const selectedSet = new Set(selectedNodeIds);
  const focusNodeId = selectedNodeIds.length === 1 ? selectedNodeIds[0] : null;
  return stripEphemeralNodeFields(nodes).map((node) => {
    const isFocus = focusNodeId != null && node.id === focusNodeId;
    const hermesClass = hermesPulseNodeIds?.has(node.id) ? "flowNodeHermesPulse" : "";
    const focusClass = isFocus ? "flowNodeChromeFocus" : "";
    const className = [node.className, hermesClass, focusClass].filter(Boolean).join(" ").trim();
    const zIndex = isFocus ? Math.max(node.zIndex ?? 0, 1000) : node.zIndex;
    return {
      ...node,
      selected: selectedSet.has(node.id),
      ...(zIndex != null ? { zIndex } : {}),
      ...(className ? { className } : {}),
    };
  });
}

export function useEdgeViewModel({
  nodes,
  edges,
  selectedNodeIds,
  selectedEdgeIds,
  nodeRunStateById,
  hermesPulseNodeIds,
}: Args) {
  const edgeView = useMemo(
    () => buildEdgeView(edges, selectedEdgeIds, nodeRunStateById),
    [edges, nodeRunStateById, selectedEdgeIds],
  );

  const nodesView = useMemo(
    () => buildNodesView(nodes, selectedNodeIds, hermesPulseNodeIds),
    [hermesPulseNodeIds, nodes, selectedNodeIds],
  );

  return { edgeView, nodesView };
}

