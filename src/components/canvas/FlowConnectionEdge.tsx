import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";
import { useMemo } from "react";
import { useProjectStore } from "@/store/projectStore";
import {
  CANVAS_EDGE_STROKE_DEFAULT,
  CANVAS_EDGE_STROKE_ACTIVE,
  CANVAS_EDGE_WIDTH_DEFAULT,
} from "@/lib/canvasColors";

/**
 * 画布自定义连线：目标节点被选中时播放流动光点动效，
 * 让用户一眼看清上游数据来源。其余连线保持默认样式。
 */
export function FlowConnectionEdge(edgeProps: EdgeProps) {
  const { id, target, markerEnd, style } = edgeProps;
  const selectedNodeIds = useProjectStore((s) => s.selectedNodeIds);
  const isHighlighted = selectedNodeIds.includes(target);

  const [edgePath] = useMemo(
    () =>
      getBezierPath({
        sourceX: edgeProps.sourceX,
        sourceY: edgeProps.sourceY,
        sourcePosition: edgeProps.sourcePosition,
        targetX: edgeProps.targetX,
        targetY: edgeProps.targetY,
        targetPosition: edgeProps.targetPosition,
      }),
    // prettier-ignore
    [edgeProps.sourceX, edgeProps.sourceY, edgeProps.sourcePosition, edgeProps.targetX, edgeProps.targetY, edgeProps.targetPosition],
  );

  // 未高亮 → 走 React Flow 默认渲染（保留原有 animated 虚线动效）
  return (
    <g className={isHighlighted ? "flowEdgeHighlighted" : undefined}>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: isHighlighted ? CANVAS_EDGE_STROKE_ACTIVE : CANVAS_EDGE_STROKE_DEFAULT,
          strokeWidth: isHighlighted ? 3 : CANVAS_EDGE_WIDTH_DEFAULT,
          transition: "stroke 200ms ease, stroke-width 200ms ease",
        }}
        markerEnd={markerEnd}
      />
      {isHighlighted && (
        <>
          {/* 柔光扩散层 */}
          <path
            d={edgePath}
            fill="none"
            stroke={CANVAS_EDGE_STROKE_ACTIVE}
            strokeWidth={6}
            strokeOpacity={0.13}
            className="flowHighlightGlow"
          />
          {/* 流动光点层 */}
          <path
            d={edgePath}
            fill="none"
            stroke={CANVAS_EDGE_STROKE_ACTIVE}
            strokeWidth={3.5}
            strokeOpacity={0.7}
            strokeDasharray="15 18"
            className="flowHighlightDash"
          />
        </>
      )}
    </g>
  );
}
