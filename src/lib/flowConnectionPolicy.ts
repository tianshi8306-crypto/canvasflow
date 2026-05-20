import type { Connection, Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { isEdgeDisabled } from "@/lib/edgeState";

/**
 * 粗粒度端口类型（M2 / B.1），与 development-plan 阶段 B 一致。
 */
export type PortType = "text" | "image" | "video" | "audio" | "script";

/** 边持久化载荷（M2 / B.2）：记录连线建立时源节点输出类型 */
export type FlowEdgePayload = {
  payloadType: PortType;
};

const TARGET_ACCEPTS: Record<string, readonly PortType[]> = {
  llm: ["text", "script"],
  /** 图/视频反推提示词、脚本同步等写入文本正文 */
  textNode: ["text", "script", "image", "video"],
  /** 脚本输出可作为上游绑定（如按 scriptBeatId 驱动首帧/参考） */
  imageNode: ["image", "text", "script"],
  imageAsset: ["image", "text", "script"],
  videoNode: ["image", "video", "audio", "text", "script"],
  audioNode: ["audio", "text", "script"],
  scriptNode: ["text", "script"],
  ffmpegConcat: ["video"],
  /** 媒体导入一般为源节点，不接受画布连线输入 */
  mediaImport: [],
  group: [],
};

/** 源节点类型对应的输出端口类型 */
export function getOutputPortType(nodeType: string | null | undefined): PortType | null {
  switch (nodeType) {
    case "llm":
    case "textNode":
      return "text";
    case "imageNode":
    case "imageAsset":
      return "image";
    case "videoNode":
    case "ffmpegConcat":
      return "video";
    case "audioNode":
      return "audio";
    case "scriptNode":
      return "script";
    case "mediaImport":
      return "text";
    default:
      return null;
  }
}

function targetAccepts(targetType: string | null | undefined): readonly PortType[] {
  if (!targetType) return [];
  return TARGET_ACCEPTS[targetType] ?? [];
}

/**
 * 是否允许从 sourceType 连到 targetType（source 输出 → target 输入）。
 */
export function isConnectionAllowed(
  sourceType: string | null | undefined,
  targetType: string | null | undefined,
): boolean {
  const out = getOutputPortType(sourceType);
  if (!out) return false;
  const accepts = targetAccepts(targetType);
  return accepts.includes(out);
}

export function connectionRejectedReason(
  sourceType: string | null | undefined,
  targetType: string | null | undefined,
): string | null {
  if (!sourceType || !targetType) return "无法识别节点类型";
  const out = getOutputPortType(sourceType);
  if (!out) return `源节点类型「${sourceType}」暂不支持作为连线起点`;
  if (!isConnectionAllowed(sourceType, targetType)) {
    const accepts = [...targetAccepts(targetType)];
    const need = accepts.length ? accepts.join(" / ") : "（无）";
    return `类型不匹配：输出为 ${out}，目标「${targetType}」仅接受 ${need}`;
  }
  return null;
}

/** 旧版 SimpleAnchors 使用的 handle id，加载时归一化为 in/out */
const LEGACY_SOURCE_HANDLES = new Set(["output"]);
const LEGACY_TARGET_HANDLES = new Set(["input"]);

export function normalizeSourceHandle(handle: string | null | undefined): string | null {
  if (!handle) return null;
  if (LEGACY_SOURCE_HANDLES.has(handle)) return "out";
  return handle;
}

export function normalizeTargetHandle(handle: string | null | undefined): string | null {
  if (!handle) return null;
  if (LEGACY_TARGET_HANDLES.has(handle)) return "in";
  return handle;
}

export function normalizeConnection(
  connection: Pick<Connection, "source" | "target" | "sourceHandle" | "targetHandle">,
): Pick<Connection, "source" | "target" | "sourceHandle" | "targetHandle"> {
  return {
    source: connection.source,
    target: connection.target,
    sourceHandle: normalizeSourceHandle(connection.sourceHandle ?? null),
    targetHandle: normalizeTargetHandle(connection.targetHandle ?? null),
  };
}

/** 仅允许单一 script 上游的目标节点类型 */
const SINGLE_SCRIPT_UPSTREAM_TARGETS = new Set([
  "imageNode",
  "imageAsset",
  "videoNode",
  "textNode",
  "audioNode",
]);

/** 统计指向 target 的启用 script 上游数量（可按 source 排除，用于校验新连线） */
export function countIncomingScriptUpstreams(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  targetNodeId: string,
  excludeSourceId?: string,
): number {
  const seen = new Set<string>();
  for (const e of edges) {
    if (isEdgeDisabled(e)) continue;
    if (e.target !== targetNodeId) continue;
    if (e.targetHandle && e.targetHandle !== "in") continue;
    if (excludeSourceId && e.source === excludeSourceId) continue;
    const n = nodes.find((x) => x.id === e.source);
    if (n?.type === "scriptNode") seen.add(e.source);
  }
  return seen.size;
}

/** 是否已存在相同 source→target 的启用边 */
export function hasParallelEdge(
  edges: Edge[],
  connection: Pick<Connection, "source" | "target">,
): boolean {
  return edges.some(
    (e) =>
      !isEdgeDisabled(e) &&
      e.source === connection.source &&
      e.target === connection.target,
  );
}

function findPath(
  edges: Edge[],
  fromId: string,
  toId: string,
): string[] | null {
  if (fromId === toId) return [fromId];
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (isEdgeDisabled(e)) continue;
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
  }
  const queue = [fromId];
  const parent = new Map<string, string | null>();
  parent.set(fromId, null);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === toId) break;
    for (const next of adj.get(cur) ?? []) {
      if (parent.has(next)) continue;
      parent.set(next, cur);
      queue.push(next);
    }
  }
  if (!parent.has(toId)) return null;
  const out: string[] = [];
  let cur: string | null = toId;
  while (cur) {
    out.push(cur);
    cur = parent.get(cur) ?? null;
  }
  out.reverse();
  return out;
}

/**
 * 统一连接校验（用于拖拽预览与落线）：
 * - source/out -> target/in 方向
 * - 类型匹配
 * - 防止自环和有向环
 */
export function validateConnection(
  connection: Pick<Connection, "source" | "target" | "sourceHandle" | "targetHandle">,
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
): { ok: true } | { ok: false; reason: string } {
  const { source, target, sourceHandle, targetHandle } = normalizeConnection(connection);
  if (!source || !target) return { ok: false, reason: "连线端点不完整" };
  if (source === target) return { ok: false, reason: "不允许连接到同一节点" };
  if (sourceHandle && sourceHandle !== "out") {
    return { ok: false, reason: "连线方向错误：起点必须是输出锚点" };
  }
  if (targetHandle && targetHandle !== "in") {
    return { ok: false, reason: "连线方向错误：终点必须是输入锚点" };
  }
  const sn = nodes.find((n) => n.id === source);
  const tn = nodes.find((n) => n.id === target);
  if (!sn || !tn) return { ok: false, reason: "无法识别节点信息" };
  const typeReason = connectionRejectedReason(sn.type, tn.type);
  if (typeReason) return { ok: false, reason: typeReason };
  if (hasParallelEdge(edges, { source, target })) {
    return { ok: false, reason: "相同节点之间已存在连线" };
  }
  if (
    sn.type === "scriptNode" &&
    tn.type &&
    SINGLE_SCRIPT_UPSTREAM_TARGETS.has(tn.type) &&
    countIncomingScriptUpstreams(nodes, edges, target) >= 1
  ) {
    return { ok: false, reason: "目标节点已有脚本上游，请勿连接第二个脚本节点" };
  }
  const backPath = findPath(edges, target, source);
  if (backPath) {
    const cycle = [source, ...backPath].map((id) => id.slice(0, 6)).join(" -> ");
    return { ok: false, reason: `检测到循环依赖：${cycle}` };
  }
  return { ok: true };
}

/**
 * 打开工程或合并画布时移除非法边，并写入 `data.payloadType`。
 */
export function sanitizeCanvasEdges(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
): { edges: Edge[]; droppedCount: number } {
  const idType = new Map(nodes.map((n) => [n.id, n.type ?? null]));
  const kept: Edge[] = [];
  let dropped = 0;
  const seenPair = new Set<string>();
  for (const e of edges) {
    if (e.source === e.target) {
      dropped++;
      continue;
    }
    const pairKey = `${e.source}\0${e.target}`;
    if (seenPair.has(pairKey)) {
      dropped++;
      continue;
    }
    const st = idType.get(e.source);
    const tt = idType.get(e.target);
    if (!st || !tt) {
      dropped++;
      continue;
    }
    if (!isConnectionAllowed(st, tt)) {
      dropped++;
      continue;
    }
    const payloadType = getOutputPortType(st);
    if (!payloadType) {
      dropped++;
      continue;
    }
    const normalized = normalizeConnection({
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
    });
    const verdict = validateConnection(normalized, nodes, kept);
    if (!verdict.ok) {
      dropped++;
      continue;
    }
    seenPair.add(pairKey);
    kept.push({
      ...e,
      sourceHandle: normalized.sourceHandle ?? "out",
      targetHandle: normalized.targetHandle ?? "in",
      data: { ...(typeof e.data === "object" && e.data ? e.data : {}), payloadType },
    });
  }
  return { edges: kept, droppedCount: dropped };
}
