import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import type { VideoIncomingRefItem } from "@/hooks/useVideoIncomingReferenceItems";
import { recordBeforeDiscreteMutation } from "@/store/projectHistory";
import { useProjectStore } from "@/store/projectStore";

/** 首尾帧模式：交换两个参考图源节点在画布上的 Y 坐标 */
export function swapFirstLastFrameSourcePositions(
  items: VideoIncomingRefItem[],
  edges: Edge[],
  nodes: Node<FlowNodeData>[],
): void {
  const images = items.filter((i) => i.kind === "image").slice(0, 2);
  if (images.length < 2) return;
  const src0 = edges.find((e) => e.id === images[0].edgeId)?.source;
  const src1 = edges.find((e) => e.id === images[1].edgeId)?.source;
  if (!src0 || !src1 || src0 === src1) return;
  const n0 = nodes.find((n) => n.id === src0);
  const n1 = nodes.find((n) => n.id === src1);
  if (!n0 || !n1) return;
  recordBeforeDiscreteMutation(useProjectStore.getState);
  useProjectStore.setState((s) => ({
    nodes: s.nodes.map((n) => {
      if (n.id === n0.id) return { ...n, position: { ...n.position, y: n1.position.y } };
      if (n.id === n1.id) return { ...n, position: { ...n.position, y: n0.position.y } };
      return n;
    }),
    projectDirty: true,
  }));
}
