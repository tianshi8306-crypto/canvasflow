import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { isEdgeDisabled } from "@/lib/edgeState";
import { CANVAS_NODE_LAYOUT_GAP } from "@/lib/nodeLayout";

/** 新建输入节点时估算高度（测量未就绪时使用） */
export const VIDEO_INPUT_NODE_ESTIMATE_H = 220;
export const VIDEO_INPUT_NODE_ESTIMATE_W = 280;
const STACK_GAP = 24;

/** 输入节点放在视频节点左侧时的 X（与画布既有逻辑一致） */
export function leftInputColumnX(videoNodeX: number): number {
  return videoNodeX - VIDEO_INPUT_NODE_ESTIMATE_W - CANVAS_NODE_LAYOUT_GAP;
}

/**
 * 在左侧输入列中，下一块输入节点的 Y：与视频节点顶对齐首块，否则叠在已有输入节点下方。
 */
export function computeNextLeftInputY(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  videoNodeId: string,
  videoY: number,
): number {
  const incoming = edges.filter(
    (e) =>
      e.target === videoNodeId &&
      (!e.targetHandle || e.targetHandle === "in") &&
      !isEdgeDisabled(e),
  );
  const sourceIds = [...new Set(incoming.map((e) => e.source))];
  let maxBottom = videoY;
  let hasInput = false;
  for (const sid of sourceIds) {
    const n = nodes.find((x) => x.id === sid);
    if (!n) continue;
    if (n.type === "imageNode" || n.type === "videoNode" || n.type === "audioNode") {
      hasInput = true;
      const h =
        typeof n.measured?.height === "number" && n.measured.height > 0
          ? n.measured.height
          : VIDEO_INPUT_NODE_ESTIMATE_H;
      maxBottom = Math.max(maxBottom, n.position.y + h);
    }
  }
  if (!hasInput) return videoY;
  return maxBottom + STACK_GAP;
}
