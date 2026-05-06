import { useCallback, useMemo } from "react";
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import type { NodeRunState } from "@/lib/runNodeState";
import { isEdgeDisabled } from "@/lib/edgeState";

export type EdgeHoverState = {
  edgeId: string;
  sourceId: string;
  targetId: string;
  x: number;
  y: number;
  summary: string;
  disabled: boolean;
};

type Args = {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  selectedEdgeIds: string[];
  nodeRunStateById: Record<string, NodeRunState>;
  hoverEdge: EdgeHoverState | null;
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
      ? { ...(edge.style ?? {}), stroke: "#64748b", strokeWidth: 1.9, strokeDasharray: "4 4", opacity: 0.72 }
      : isFailed
        ? { ...(edge.style ?? {}), stroke: "#ef4444", strokeWidth: 2.2 }
        : isWarning
          ? { ...(edge.style ?? {}), stroke: "#f59e0b", strokeWidth: 2.1, strokeDasharray: "6 4" }
          : isRunning
            ? { ...(edge.style ?? {}), stroke: "#60a5fa", strokeWidth: 2.4 }
            : edge.style;
    return {
      ...edge,
      className,
      style,
      animated: isDisabled || isFailed ? false : edge.animated || isRunning,
    };
  });
}

export function buildNodesView(
  nodes: Node<FlowNodeData>[],
  hoverEdge: EdgeHoverState | null,
): Node<FlowNodeData>[] {
  if (!hoverEdge) return nodes;
  const linked = new Set([hoverEdge.sourceId, hoverEdge.targetId]);
  return nodes.map((node) => {
    const extraClass = linked.has(node.id) ? "flowNodeLinkedByEdge" : "flowNodeDimmedByEdge";
    return { ...node, className: `${node.className ?? ""} ${extraClass}`.trim() };
  });
}

export function summarizeEdgePayloadText(
  nodes: Node<FlowNodeData>[],
  sourceId: string,
  targetId: string,
  disabled: boolean,
): string {
  const source = nodes.find((n) => n.id === sourceId);
  const target = nodes.find((n) => n.id === targetId);
  if (!source || !target) return "数据链路";
  const srcType = source.type ?? "unknown";
  const dstType = target.type ?? "unknown";
  const promptLen = (source.data.prompt ?? "").trim().length;
  const path = source.data.path?.trim() ?? "";
  const assetId = source.data.assetId?.trim() ?? "";
  const parts: string[] = [`${srcType} -> ${dstType}`];
  if (promptLen > 0) parts.push(`文本 ${promptLen} 字`);
  if (path) parts.push(`路径 ${path.split(/[\\/]/).pop() ?? path}`);
  if (!path && assetId) parts.push(`资产 ${assetId.slice(0, 8)}…`);
  if (disabled) parts.push("已禁用（不参与执行/推导）");
  return parts.join(" · ");
}

export function useEdgeViewModel({
  nodes,
  edges,
  selectedEdgeIds,
  nodeRunStateById,
  hoverEdge,
}: Args) {
  const edgeView = useMemo(
    () => buildEdgeView(edges, selectedEdgeIds, nodeRunStateById),
    [edges, nodeRunStateById, selectedEdgeIds],
  );

  const nodesView = useMemo(() => buildNodesView(nodes, hoverEdge), [nodes, hoverEdge]);

  const summarizeEdgePayload = useCallback(
    (sourceId: string, targetId: string, disabled: boolean) =>
      summarizeEdgePayloadText(nodes, sourceId, targetId, disabled),
    [nodes],
  );

  return { edgeView, nodesView, summarizeEdgePayload };
}

