import type { Edge, Node } from "@xyflow/react";
import { cloneFlowNodeData } from "@/lib/flowNodeDataClone";
import { isEdgeDisabled } from "@/lib/edgeState";
import { makeFlowEdge } from "@/lib/flowEdge";
import { computeImageOutputGridPositions } from "@/lib/nodeLayout";
import type { FlowNodeData } from "@/lib/types";
import type { SplitShotBeatAssignment } from "@/lib/storyboard/splitSpawnedImagesIntoStoryboard";
import { useProjectStore } from "@/store/projectStore";

function applySplitShotBinding(
  data: FlowNodeData,
  assignment: SplitShotBeatAssignment | undefined,
): FlowNodeData {
  if (!assignment) return paramsWithoutScriptBeat(data);
  const base =
    data.params && typeof data.params === "object" && !Array.isArray(data.params)
      ? { ...(data.params as Record<string, unknown>) }
      : {};
  return {
    ...data,
    params: {
      ...base,
      scriptBeatId: assignment.beatId,
      shotNumber: assignment.shotNumber,
    },
  };
}

function paramsWithoutScriptBeat(data: FlowNodeData): FlowNodeData {
  const p = data.params;
  if (!p || typeof p !== "object" || Array.isArray(p)) return data;
  const next = { ...p } as Record<string, unknown>;
  delete next.scriptBeatId;
  delete next.shotNumber;
  return { ...data, params: next };
}

function incomingEdgesToNode(edges: Edge[], targetId: string): Edge[] {
  return edges.filter((e) => e.target === targetId && !isEdgeDisabled(e));
}

/**
 * 将多图生成中除主节点外的成片落到独立图片节点，并按宫格相对主节点排版。
 * 主节点应已写入 `relPaths[0]`；本函数处理 `relPaths.slice(1)`。
 */
export function spawnExtraImageOutputNodes(opts: {
  sourceNodeId: string;
  extraRelPaths: string[];
  imageWidth?: number;
  imageHeight?: number;
  /** 拆镜入库：与 extraRelPaths 一一对应，绑定后续空缺镜头 */
  splitShotAssignments?: SplitShotBeatAssignment[];
}): string[] {
  const extras = opts.extraRelPaths.map((p) => p.trim()).filter(Boolean);
  if (extras.length === 0) return [];

  const state = useProjectStore.getState();
  const source = state.nodes.find((n) => n.id === opts.sourceNodeId);
  if (!source || source.type !== "imageNode") return [];

  const total = extras.length + 1;
  const positions = computeImageOutputGridPositions(total, source.position);
  const inEdges = incomingEdgesToNode(state.edges, opts.sourceNodeId);

  const baseLabel = (source.data.label ?? "图片").trim() || "图片";
  const newNodes: Node<FlowNodeData>[] = [];
  const newEdges: Edge[] = [];

  extras.forEach((relPath, i) => {
    const nodeId = crypto.randomUUID();
    const pos = positions[i + 1] ?? {
      x: source.position.x + (i + 1) * 560,
      y: source.position.y,
    };
    const assignment = opts.splitShotAssignments?.[i];
    let data = cloneFlowNodeData(source.data);
    data = applySplitShotBinding(data, assignment);
    data.path = relPath;
    data.label = assignment
      ? `镜头 ${assignment.shotNumber} 图`
      : `${baseLabel} ${i + 2}`;
    if (opts.imageWidth && opts.imageHeight) {
      data.imageWidth = opts.imageWidth;
      data.imageHeight = opts.imageHeight;
    }

    newNodes.push({
      id: nodeId,
      type: "imageNode",
      position: pos,
      data,
    });

    for (const e of inEdges) {
      const srcNode = state.nodes.find((n) => n.id === e.source);
      newEdges.push(makeFlowEdge(e.source, nodeId, srcNode?.type ?? null));
    }
  });

  state.addNodesWithEdges(newNodes, newEdges);
  return newNodes.map((n) => n.id);
}
