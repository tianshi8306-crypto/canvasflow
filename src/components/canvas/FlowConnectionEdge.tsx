import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";
import { memo, useMemo } from "react";
import { useProjectStore } from "@/store/projectStore";
import {
  CANVAS_EDGE_STROKE_DEFAULT,
  CANVAS_EDGE_STROKE_ACTIVE,
  CANVAS_EDGE_WIDTH_DEFAULT,
} from "@/lib/canvasColors";

/**
 * 画布自定义连线：目标节点被选中时播放流动光点动效，
 * 让用户一眼看清上游数据来源。其余连线保持默认样式。
 *
 * 性能优化：使用 memo 避免 target 未改变时的无效重渲染，
 * store selector 仅订阅 target 是否在 selectedNodeIds 中而非完整数组。
 */
function FlowConnectionEdgeImpl(edgeProps: EdgeProps) {
  const { id, target, markerEnd, style } = edgeProps;
  // 只订阅 target 是否被选中，而非完整 selectedNodeIds 数组，
  // 避免任意节点选中变化触发全量边重渲染
  const isHighlighted = useProjectStore((s) => s.selectedNodeIds.includes(target));

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

/** 画布自定义连线组件，已用 memo 优化，仅在 target 选中状态或几何属性变化时重渲染 */
export const FlowConnectionEdge = memo(FlowConnectionEdgeImpl);
