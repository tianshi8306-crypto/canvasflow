import type { FlowNodeData } from "@/lib/types";

export function cloneFlowNodeData(data: FlowNodeData): FlowNodeData {
  return JSON.parse(JSON.stringify(data)) as FlowNodeData;
}
