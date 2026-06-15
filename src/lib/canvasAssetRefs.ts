import type { FlowNodeData } from "@/lib/types";
import type { Node } from "@xyflow/react";

function maybeInsertAssetPath(out: Set<string>, raw: string) {
  const t = raw.trim().replace(/\\/g, "/");
  if (t.startsWith("assets/") && !t.includes("..")) {
    out.add(t);
  }
}

function walkValue(value: unknown, out: Set<string>) {
  if (typeof value === "string") {
    maybeInsertAssetPath(out, value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walkValue(item, out);
    return;
  }
  if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      walkValue(v, out);
    }
  }
}

/** 从节点 data（含 scriptBeats / timelineClips 等嵌套字段）收集 assets 相对路径 */
export function collectAssetRelPathsFromNodeData(data: FlowNodeData | undefined): string[] {
  const out = new Set<string>();
  walkValue(data, out);
  return [...out];
}

export function collectAssetRelPathsFromNodes(nodes: Node<FlowNodeData>[]): string[] {
  const out = new Set<string>();
  for (const node of nodes) {
    for (const p of collectAssetRelPathsFromNodeData(node.data)) {
      out.add(p);
    }
  }
  return [...out];
}
