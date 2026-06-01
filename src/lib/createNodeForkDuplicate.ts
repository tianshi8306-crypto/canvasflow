import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { cloneFlowNodeData } from "@/lib/flowNodeDataClone";
import { CANVAS_NODE_LAYOUT_GAP, resolveNodeLayoutFootprint } from "@/lib/nodeLayout";
import {
  getOutputPortType,
  hasParallelEdge,
  normalizeConnection,
  validateConnection,
} from "@/lib/flowConnectionPolicy";

/** @deprecated 旧版对角偏移，仅测试对照保留 */
export const FORK_DUPLICATE_OFFSET = 36;

const NON_FORKABLE_TYPES = new Set(["group", "ffmpegConcat"]);

type LayoutRect = { x: number; y: number; width: number; height: number };

function layoutRectsOverlap(a: LayoutRect, b: LayoutRect, gap: number): boolean {
  return (
    a.x < b.x + b.width + gap &&
    a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap &&
    a.y + a.height + gap > b.y
  );
}

function nodeLayoutRect(n: Node<FlowNodeData>, includeGenPanel = false): LayoutRect {
  const { w, h } = resolveNodeLayoutFootprint(n, { includeGenPanel });
  return { x: n.position.x, y: n.position.y, width: w, height: h };
}

function collidesWithObstacles(
  pos: { x: number; y: number },
  size: { w: number; h: number },
  obstacles: Node<FlowNodeData>[],
  gap: number,
  expandedObstacleIds: ReadonlySet<string>,
): boolean {
  const candidate: LayoutRect = { x: pos.x, y: pos.y, width: size.w, height: size.h };
  return obstacles.some((n) =>
    layoutRectsOverlap(
      candidate,
      nodeLayoutRect(n, expandedObstacleIds.has(n.id)),
      gap,
    ),
  );
}

/**
 * 为 fork 副本找落点：优先正下方（同 X），其次正右方（同 Y），再上方/左侧；
 * 每方向沿轴扫描多格，避开已有节点，避免压在原节点上或挡住连线。
 */
export function resolveForkDuplicatePosition(
  source: Node<FlowNodeData>,
  obstacles: Node<FlowNodeData>[],
  gap = CANVAS_NODE_LAYOUT_GAP,
  expandedNodeIds: ReadonlySet<string> = new Set([source.id]),
): { x: number; y: number } {
  const sourceDim = resolveNodeLayoutFootprint(source, {
    includeGenPanel: expandedNodeIds.has(source.id),
  });
  const forkDim = resolveNodeLayoutFootprint(source, {
    includeGenPanel: expandedNodeIds.has(source.id),
  });
  const sx = source.position.x;
  const sy = source.position.y;

  const candidates: { x: number; y: number }[] = [];

  for (let row = 0; row < 6; row++) {
    candidates.push({
      x: sx,
      y: sy + sourceDim.h + gap + row * (forkDim.h + gap),
    });
  }
  for (let col = 0; col < 6; col++) {
    candidates.push({
      x: sx + sourceDim.w + gap + col * (forkDim.w + gap),
      y: sy,
    });
  }
  for (let row = 0; row < 4; row++) {
    candidates.push({
      x: sx,
      y: sy - forkDim.h - gap - row * (forkDim.h + gap),
    });
  }
  for (let col = 0; col < 4; col++) {
    candidates.push({
      x: sx - forkDim.w - gap - col * (forkDim.w + gap),
      y: sy,
    });
  }

  for (const pos of candidates) {
    if (!collidesWithObstacles(pos, forkDim, obstacles, gap, expandedNodeIds)) return pos;
  }

  return { x: sx, y: sy + sourceDim.h + gap };
}

/** 试验分支：复制节点参数，保留上游入边，不复制下游出边；成片路径不继承 */
export function prepareForkedNodeData(node: Node<FlowNodeData>): FlowNodeData {
  let data = cloneFlowNodeData(node.data);

  if (node.type === "imageNode" || node.type === "videoNode") {
    const label = `${data.label ?? ""} 副本`.trim();
    data = { ...data, label, path: "" };
  } else if (node.type === "audioNode") {
    data = { ...data, path: "" };
  }

  if (node.type === "videoNode" && data.video) {
    data = {
      ...data,
      video: {
        ...data.video,
        activeJob: undefined,
      },
    };
  }

  return data;
}

export function buildForkDuplicatePaste(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  sourceNodeIds: readonly string[],
): { nextNodes: Node<FlowNodeData>[]; nextEdges: Edge[]; newNodeIds: string[] } | null {
  const idsToFork = sourceNodeIds.filter((id) => {
    const n = nodes.find((x) => x.id === id);
    if (!n?.type) return false;
    return !NON_FORKABLE_TYPES.has(n.type);
  });
  if (idsToFork.length === 0) return null;

  const idMap = new Map<string, string>();
  for (const id of idsToFork) {
    idMap.set(id, crypto.randomUUID());
  }

  const placedForks: Node<FlowNodeData>[] = [];
  const nextNodes: Node<FlowNodeData>[] = [];
  const expandedNodeIds = new Set(sourceNodeIds);

  for (const oldId of idsToFork) {
    const n = nodes.find((x) => x.id === oldId)!;
    const newId = idMap.get(oldId)!;
    const obstacles = [
      ...nodes.filter((x) => x.id !== oldId),
      ...placedForks,
    ];
    const position = resolveForkDuplicatePosition(n, obstacles, CANVAS_NODE_LAYOUT_GAP, expandedNodeIds);
    const forkNode: Node<FlowNodeData> = {
      ...n,
      id: newId,
      data: prepareForkedNodeData(n),
      position,
      selected: true,
    };
    placedForks.push(forkNode);
    nextNodes.push(forkNode);
  }

  const mergedNodes = [...nodes, ...nextNodes];
  const nextEdges: Edge[] = [];

  for (const oldId of idsToFork) {
    const newId = idMap.get(oldId)!;
    const incoming = edges.filter((e) => e.target === oldId);
    for (const e of incoming) {
      const sourceNode = nodes.find((n) => n.id === e.source);
      const payloadType = sourceNode?.type ? getOutputPortType(sourceNode.type) : null;
      const normalized = normalizeConnection({
        source: e.source,
        target: newId,
        sourceHandle: e.sourceHandle ?? null,
        targetHandle: e.targetHandle ?? null,
      });
      if (hasParallelEdge([...edges, ...nextEdges], normalized)) continue;
      const verdict = validateConnection(normalized, mergedNodes, [...edges, ...nextEdges]);
      if (!verdict.ok) continue;
      const clone = JSON.parse(JSON.stringify(e)) as Edge;
      nextEdges.push({
        ...clone,
        id: crypto.randomUUID(),
        source: e.source,
        target: newId,
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
  }

  return {
    nextNodes,
    nextEdges,
    newNodeIds: idsToFork.map((id) => idMap.get(id)!),
  };
}
