import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { cloneFlowNodeData } from "@/lib/flowNodeDataClone";
import {
  getOutputPortType,
  hasParallelEdge,
  normalizeConnection,
  validateConnection,
} from "@/lib/flowConnectionPolicy";
import {
  applyScriptBeatRemapToScriptNodeData,
  buildScriptBeatIdRemapForPaste,
  findUpstreamScriptNodeIdInSubgraph,
  remapParamsScriptBeatIdForPaste,
} from "@/lib/pasteScriptBeatRemap";

export type PasteClipboardSnapshot = {
  copiedNodes: Node<FlowNodeData>[];
  copiedEdges: Edge[];
};

/**
 * 由剪贴板快照生成待合并进画布的节点列表（新 id、位移、脚本镜头 id 独立副本）。
 */
export function buildPasteNodesFromClipboard(
  snapshot: PasteClipboardSnapshot,
  offset = 36,
): { nextNodes: Node<FlowNodeData>[]; idMap: Map<string, string> } {
  const { copiedNodes, copiedEdges } = snapshot;
  const idMap = new Map<string, string>();
  for (const n of copiedNodes) {
    idMap.set(n.id, crypto.randomUUID());
  }
  const scriptBeatRemapsByOldNodeId = new Map<string, Map<string, string>>();
  for (const n of copiedNodes) {
    if (n.type !== "scriptNode") continue;
    const map = buildScriptBeatIdRemapForPaste(n.data.scriptBeats);
    if (map.size > 0) scriptBeatRemapsByOldNodeId.set(n.id, map);
  }

  const copiedIdSet = new Set(copiedNodes.map((n) => n.id));

  const nextNodes = copiedNodes.map((n) => {
    const id = idMap.get(n.id)!;
    let data = cloneFlowNodeData(n.data);
    if (n.type === "scriptNode") {
      const bm = scriptBeatRemapsByOldNodeId.get(n.id);
      if (bm?.size) data = applyScriptBeatRemapToScriptNodeData(data, bm);
    } else {
      const upScript = findUpstreamScriptNodeIdInSubgraph(n.id, copiedEdges, copiedNodes);
      const bm = upScript ? scriptBeatRemapsByOldNodeId.get(upScript) : undefined;
      data = remapParamsScriptBeatIdForPaste(data, bm);
    }
    if (n.type === "imageNode" || n.type === "videoNode") {
      data = { ...data, label: `${data.label ?? ""} 副本`.trim() };
    }
    if (n.type === "group") {
      const base = data.label?.trim() || "分组";
      data = { ...data, label: `${base} 副本` };
    }
    const nextParentId =
      n.parentId && idMap.has(n.parentId) ? idMap.get(n.parentId) : n.parentId;
    // 仅对粘贴子树的根节点位移，避免嵌套组内成员被叠加两次 offset（G7）
    const isPasteRoot =
      !n.parentId || !copiedIdSet.has(n.parentId);
    const position = isPasteRoot
      ? { x: n.position.x + offset, y: n.position.y + offset }
      : { ...n.position };
    return {
      ...n,
      id,
      parentId: nextParentId,
      extent: nextParentId ? ("parent" as const) : n.extent,
      data,
      selected: false,
      position,
    };
  });
  return { nextNodes, idMap };
}

/**
 * 将剪贴板内连线映射到新节点 id，并过滤非法类型、补全 `payloadType`。
 */
export function buildPasteEdgesFromClipboard(
  copiedEdges: Edge[],
  idMap: Map<string, string>,
  nextNodes: Node<FlowNodeData>[],
): Edge[] {
  const nextEdges: Edge[] = [];
  for (const e of copiedEdges) {
    const ns = idMap.get(e.source) ?? e.source;
    const nt = idMap.get(e.target) ?? e.target;
    const st = nextNodes.find((n) => n.id === ns)?.type;
    const payloadType = st ? getOutputPortType(st) : null;
    const normalized = normalizeConnection({
      source: ns,
      target: nt,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
    });
    if (hasParallelEdge(nextEdges, normalized)) continue;
    const verdict = validateConnection(normalized, nextNodes, nextEdges);
    if (!verdict.ok) continue;
    const clone = JSON.parse(JSON.stringify(e)) as Edge;
    nextEdges.push({
      ...clone,
      id: crypto.randomUUID(),
      source: ns,
      target: nt,
      sourceHandle: normalized.sourceHandle ?? "out",
      targetHandle: normalized.targetHandle ?? "in",
      selected: false,
      data:
        payloadType
          ? {
              ...(typeof clone.data === "object" && clone.data ? clone.data : {}),
              payloadType,
            }
          : clone.data,
    });
  }
  return nextEdges;
}
