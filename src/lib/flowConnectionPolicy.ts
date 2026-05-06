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
  textNode: ["text", "script"],
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
  const { source, target, sourceHandle, targetHandle } = connection;
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
  for (const e of edges) {
    if (e.source === e.target) {
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
    kept.push({
      ...e,
      data: { ...(typeof e.data === "object" && e.data ? e.data : {}), payloadType },
    });
  }
  return { edges: kept, droppedCount: dropped };
}
