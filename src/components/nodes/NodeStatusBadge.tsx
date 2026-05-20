/**
 * NodeStatusBadge - 节点状态徽章组件
 *
 * 显示在节点卡片上的运行状态角标
 */

import type { NodeExecutionStatus, NodeStatus } from "@/lib/types";

interface NodeStatusBadgeProps {
  status?: NodeStatus;
  size?: "sm" | "md";
  showProgress?: boolean;
}

const STATUS_CONFIG: Record<
  NodeExecutionStatus,
  { label: string; className: string; icon?: string }
> = {
  idle: { label: "", className: "" },
  pending: { label: "等待", className: "nodeStatus--pending" },
  running: { label: "运行中", className: "nodeStatus--running" },
  succeeded: { label: "完成", className: "nodeStatus--succeeded" },
  failed: { label: "失败", className: "nodeStatus--failed" },
  skipped: { label: "跳过", className: "nodeStatus--skipped" },
};

function RunningSpinner() {
  return (
    <svg
      className="nodeStatusSpinner"
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

export function NodeStatusBadge({ status, size = "md", showProgress = false }: NodeStatusBadgeProps) {
  if (!status) return null;

  const { status: s, agentName, phase, error, progress } = status;

  if (s === "idle") return null;

  const config = STATUS_CONFIG[s];
  if (!config) return null;

  const sizeClass = size === "sm" ? "nodeStatus--sm" : "";

  return (
    <div
      className={`nodeStatus ${config.className} ${sizeClass}`}
      title={error ? `${config.label}：${error}` : agentName ? `${agentName} - ${phase ?? config.label}` : config.label}
    >
      {s === "running" && <RunningSpinner />}
      {s === "running" && showProgress && progress !== undefined ? (
        <span>{progress}%</span>
      ) : (
        <span>{config.label}</span>
      )}
      {s === "running" && agentName && <span className="nodeStatusAgent">{agentName}</span>}
    </div>
  );
}

/** 紧凑型状态徽章（仅图标） */
export function NodeStatusDot({ status }: { status?: NodeStatus }) {
  if (!status) return null;

  const { status: s } = status;
  if (s === "idle" || s === "succeeded") return null;

  const config = STATUS_CONFIG[s];
  if (!config) return null;

  return <span className={`nodeStatusDot ${config.className}`} title={config.label} />;
}
