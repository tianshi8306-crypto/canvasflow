import type { Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";

/** 在节点 data（及嵌套 JSON）中精确替换旧素材路径 */
export function applyAssetPathMappingsToNodes(
  nodes: Node<FlowNodeData>[],
  mappings: Record<string, string>,
): Node<FlowNodeData>[] {
  const entries = Object.entries(mappings);
  if (entries.length === 0) return nodes;

  const replaceValue = (value: unknown): unknown => {
    if (typeof value === "string") {
      return mappings[value] ?? value;
    }
    if (Array.isArray(value)) {
      return value.map(replaceValue);
    }
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
          key,
          replaceValue(nested),
        ]),
      );
    }
    return value;
  };

  return nodes.map((node) => ({
    ...node,
    data: replaceValue(node.data) as FlowNodeData,
  }));
}
