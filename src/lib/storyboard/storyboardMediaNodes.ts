import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { getScriptBeatIdFromParams } from "@/lib/incomingScriptBinding";
import { isEdgeDisabled } from "@/lib/edgeState";

export function beatIdFromNode(data: FlowNodeData): string | null {
  const id = getScriptBeatIdFromParams(data);
  return id?.trim() ? id : null;
}

/** 脚本节点直连下游、已绑定 scriptBeatId 的 imageNode（每镜头取第一个） */
export function findImageNodesForScript(
  scriptNodeId: string,
  nodes: Node<FlowNodeData>[],
  edges: { source: string; target: string }[],
): Map<string, string> {
  const byBeat = new Map<string, string>();
  const linkedIds = new Set(
    edges.filter((e) => e.source === scriptNodeId).map((e) => e.target),
  );
  for (const n of nodes) {
    if (n.type !== "imageNode" || !linkedIds.has(n.id)) continue;
    const beatId = beatIdFromNode(n.data);
    if (beatId && !byBeat.has(beatId)) byBeat.set(beatId, n.id);
  }
  return byBeat;
}

/**
 * 按 scriptBeatId 解析关联的 videoNode：
 * - 脚本直连视频；
 * - 或「脚本→图片→视频」链路上、与镜头绑定的图片所连的视频（Hermes / 一键建链布局）。
 */
export function findVideoNodesForScript(
  scriptNodeId: string,
  nodes: Node<FlowNodeData>[],
  edges: { source: string; target: string }[],
): Map<string, string> {
  const byBeat = new Map<string, string>();

  const linkedFromScript = new Set(
    edges.filter((e) => e.source === scriptNodeId).map((e) => e.target),
  );
  for (const n of nodes) {
    if (n.type !== "videoNode" || !linkedFromScript.has(n.id)) continue;
    const beatId = beatIdFromNode(n.data);
    if (beatId && !byBeat.has(beatId)) byBeat.set(beatId, n.id);
  }

  const imageByBeat = findImageNodesForScript(scriptNodeId, nodes, edges);
  for (const [beatId, imageNodeId] of imageByBeat) {
    if (byBeat.has(beatId)) continue;
    for (const e of edges) {
      if (isEdgeDisabled(e as Edge)) continue;
      if (e.source !== imageNodeId) continue;
      const target = nodes.find((n) => n.id === e.target);
      if (target?.type !== "videoNode") continue;
      const vBeat = beatIdFromNode(target.data);
      if (vBeat && vBeat !== beatId) continue;
      byBeat.set(beatId, target.id);
      break;
    }
  }

  return byBeat;
}

/** 镜头是否已有可用分镜图（节点成片或 storyboardShots.imagePath） */
export function shotHasGeneratedImage(
  beatId: string,
  shot: { imagePath?: string } | undefined,
  imageNode: Node<FlowNodeData> | undefined,
): boolean {
  if (shot?.imagePath?.trim()) return true;
  if (imageNode?.data.path?.trim() || imageNode?.data.assetId?.trim()) return true;
  return false;
}
