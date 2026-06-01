import type { Edge, Node } from "@xyflow/react";
import { isEdgeDisabled } from "@/lib/edgeState";
import { getScriptBeatIdFromParams } from "@/lib/incomingScriptBinding";
import type { FlowNodeData } from "@/lib/types";

/** 从合成节点上游视频追溯关联的脚本节点（用于「从脚本填充」）。 */
export function findScriptNodeForCompose(
  concatNodeId: string,
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
): string | null {
  const incoming = edges.filter((e) => e.target === concatNodeId && !isEdgeDisabled(e));
  const seen = new Set<string>();

  for (const edge of incoming) {
    const source = nodes.find((n) => n.id === edge.source);
    if (!source || source.type !== "videoNode") continue;

    for (const e2 of edges) {
      if (e2.target !== source.id) continue;
      const script = nodes.find((n) => n.id === e2.source && n.type === "scriptNode");
      if (script && !seen.has(script.id)) {
        seen.add(script.id);
        return script.id;
      }
    }

    const beatId = getScriptBeatIdFromParams(source.data);
    if (!beatId) continue;
    for (const n of nodes) {
      if (n.type !== "scriptNode" || seen.has(n.id)) continue;
      if ((n.data.scriptBeats ?? []).some((b) => b.id === beatId)) {
        seen.add(n.id);
        return n.id;
      }
    }
  }

  return null;
}
