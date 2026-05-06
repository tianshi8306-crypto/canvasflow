import type { Edge } from "@xyflow/react";

type EdgeDataWithDisabled = {
  disabled?: boolean;
};

/** 任意带 `data` 的边对象（含简化的 store 结构）均适用。 */
export function isEdgeDisabled(edge: { data?: unknown }): boolean {
  const data = edge.data;
  if (!data || typeof data !== "object") return false;
  return Boolean((data as EdgeDataWithDisabled).disabled);
}

/** 执行图/拓扑推导统一入口：仅保留启用连线。 */
export function enabledEdges(edges: Edge[]): Edge[] {
  return edges.filter((e) => !isEdgeDisabled(e));
}

export function edgeEditingLockedMessage(): string {
  return "执行中已锁定连线编辑，请等待当前运行完成";
}

export function edgeToggleStatusText(disabled: boolean, count: number): string {
  return `${disabled ? "已禁用" : "已启用"} ${count} 条连线`;
}

export function edgeToggleActionLabel(disabled: boolean, count: number): string {
  return `${disabled ? "禁用连线" : "启用连线"}${count > 1 ? `（${count}）` : ""}`;
}

export function edgeLocateNodeStatusText(direction: "upstream" | "downstream", nodeId: string): string {
  return `已定位${direction === "upstream" ? "上游" : "下游"}节点：${nodeId.slice(0, 8)}`;
}

