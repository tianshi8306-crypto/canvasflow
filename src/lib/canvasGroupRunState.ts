import type { NodeRunState } from "@/lib/runNodeState";

export type GroupRunAggregate = "idle" | "running" | "failed" | "succeeded" | "partial";

const AGGREGATE_LABEL: Record<GroupRunAggregate, string> = {
  idle: "",
  running: "组内执行中",
  failed: "组内部分失败",
  succeeded: "组内已完成",
  partial: "组内部分完成",
};

export function aggregateGroupRunState(
  memberIds: string[],
  nodeRunStateById: Record<string, NodeRunState>,
): GroupRunAggregate {
  const states = memberIds
    .map((id) => nodeRunStateById[id])
    .filter((s): s is NodeRunState => Boolean(s));
  if (states.length === 0) return "idle";
  if (states.some((s) => s === "running")) return "running";
  if (states.some((s) => s === "failed")) return "failed";
  if (states.every((s) => s === "succeeded" || s === "skipped")) {
    return states.some((s) => s === "succeeded") ? "succeeded" : "idle";
  }
  if (states.some((s) => s === "succeeded")) return "partial";
  return "idle";
}

export function groupRunAggregateLabel(aggregate: GroupRunAggregate): string {
  return AGGREGATE_LABEL[aggregate];
}
