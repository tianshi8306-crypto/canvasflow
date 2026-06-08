import type { Edge, Node, Viewport } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import {
  CURRENT_CANVAS_VERSION,
  type CanvasProjectMeta,
  type SerializeCanvasOptions,
} from "@/lib/serialization";

// ── 增量序列化缓存 ──
// 保存后缓存每个节点/边的 JSON 字符串。
// 下次保存时，仅对脏节点/边重新序列化，其余直接复用缓存字符串拼接。

const nodeJsonCache = new Map<string, string>();
const edgeJsonCache = new Map<string, string>();

// 脏节点/边 ID 集合（由 projectStore 的 mutation 方法维护）
const dirtyNodeIds = new Set<string>();
const dirtyEdgeIds = new Set<string>();

/** 标记一个节点需要下次保存时重新序列化 */
export function markNodeDirty(nodeId: string) {
  dirtyNodeIds.add(nodeId);
}

/** 标记多个节点需要重新序列化 */
export function markNodesDirty(nodeIds: string[]) {
  for (const id of nodeIds) dirtyNodeIds.add(id);
}

/** 标记一条边需要重新序列化 */
export function markEdgeDirty(edgeId: string) {
  dirtyEdgeIds.add(edgeId);
}

/** 标记所有节点/边都需要重新序列化（工程加载、大规模编辑后） */
export function markAllDirty(nodes: Node<FlowNodeData>[], edges: Edge[]) {
  for (const n of nodes) dirtyNodeIds.add(n.id);
  for (const e of edges) dirtyEdgeIds.add(e.id);
}

/** 清除脏标记（保存后调用） */
export function clearDirtyTracking() {
  dirtyNodeIds.clear();
  dirtyEdgeIds.clear();
}

/**
 * 增量序列化：脏节点用 JSON.stringify，其余复用缓存。
 * 返回完整 JSON 字符串，与 serializeCanvas 格式完全一致。
 */
export function incrementalSerializeCanvas(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  viewport: Viewport,
  meta?: CanvasProjectMeta,
  options?: SerializeCanvasOptions,
): string {
  const pretty = options?.pretty ?? false;
  const sep = pretty ? ",\n" : ",";
  const pad = pretty ? "  " : "";

  // Viewport（视口变更频繁，每次序列化）
  const vpJson = JSON.stringify(viewport);

  // 节点：脏则重新序列化并更新缓存，否则复用
  const nodeStrs: string[] = [];
  for (const node of nodes) {
    if (dirtyNodeIds.has(node.id) || !nodeJsonCache.has(node.id)) {
      const json = JSON.stringify(node);
      nodeJsonCache.set(node.id, json);
      nodeStrs.push(json);
    } else {
      nodeStrs.push(nodeJsonCache.get(node.id)!);
    }
  }
  // 清理已删除节点的缓存
  const currentIds = new Set(nodes.map((n) => n.id));
  for (const key of nodeJsonCache.keys()) {
    if (!currentIds.has(key)) nodeJsonCache.delete(key);
  }

  // 边：脏则重新序列化并更新缓存，否则复用
  const edgeStrs: string[] = [];
  for (const edge of edges) {
    if (dirtyEdgeIds.has(edge.id) || !edgeJsonCache.has(edge.id)) {
      const json = JSON.stringify(edge);
      edgeJsonCache.set(edge.id, json);
      edgeStrs.push(json);
    } else {
      edgeStrs.push(edgeJsonCache.get(edge.id)!);
    }
  }
  const currentEdgeIds = new Set(edges.map((e) => e.id));
  for (const key of edgeJsonCache.keys()) {
    if (!currentEdgeIds.has(key)) edgeJsonCache.delete(key);
  }

  // 组装
  const parts: string[] = [];
  parts.push('{');
  parts.push(pad + '"version":' + CURRENT_CANVAS_VERSION + ',');
  parts.push(pad + '"viewport":' + vpJson + ',');

  parts.push(pad + '"nodes":[');
  if (pretty && nodeStrs.length > 0) {
    parts.push("\n    " + nodeStrs.join(",\n    ") + "\n  ");
  } else {
    parts.push(nodeStrs.join(","));
  }
  parts.push('],');

  parts.push(pad + '"edges":[');
  if (pretty && edgeStrs.length > 0) {
    parts.push("\n    " + edgeStrs.join(",\n    ") + "\n  ");
  } else {
    parts.push(edgeStrs.join(","));
  }
  parts.push(']');

  if (
    meta &&
    (meta.imageNodeCounter != null ||
      meta.videoNodeCounter != null ||
      meta.textNodeCounter != null ||
      meta.audioNodeCounter != null ||
      meta.scriptNodeCounter != null ||
      meta.activeStyleId !== undefined)
  ) {
    parts.push(sep);
    parts.push(pad + '"meta":' + JSON.stringify(meta));
  }

  parts.push(pretty ? "\n}" : "}");
  return parts.join("");
}
