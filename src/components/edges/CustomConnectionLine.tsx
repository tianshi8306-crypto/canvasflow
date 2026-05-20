/**
 * 自定义连接线组件
 * 用于在拖拽连线时显示预览线
 */
import { memo } from "react";
import { getBezierPath, type ConnectionLineComponentProps } from "@xyflow/react";

const CustomConnectionLine = memo((props: ConnectionLineComponentProps) => {
  const {
    fromX,
    fromY,
    toX,
    toY,
    fromPosition,
    toPosition,
    connectionLineStyle,
    connectionStatus,
  } = props;

  const [edgePath] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
  });

  // 根据连接状态确定样式类
  const statusClass = connectionStatus
    ? ` connection-line--${connectionStatus}`
    : "";

  return (
    <g className="custom-connection-line-group">
      {/* 底层阴影效果 */}
      <path
        d={edgePath}
        fill="none"
        className={`connection-line connection-line-shadow${statusClass}`}
        style={connectionLineStyle}
      />
      {/* 主连接线 */}
      <path
        d={edgePath}
        fill="none"
        className={`connection-line${statusClass}`}
        style={connectionLineStyle}
      />
      {/* 起点端点 */}
      <circle
        cx={fromX}
        cy={fromY}
        r={3}
        className="connection-line-endpoint"
      />
      {/* 终点端点 */}
      <circle
        cx={toX}
        cy={toY}
        r={3}
        className="connection-line-endpoint connection-line-endpoint--target"
      />
    </g>
  );
});

CustomConnectionLine.displayName = "CustomConnectionLine";

export { CustomConnectionLine };