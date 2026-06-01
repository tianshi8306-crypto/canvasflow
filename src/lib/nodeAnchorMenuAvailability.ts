import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { isEdgeDisabled } from "@/lib/edgeState";
import {
  countIncomingScriptUpstreams,
  isConnectionAllowed,
} from "@/lib/flowConnectionPolicy";
import type { AnchorMenuKey, CreationKind } from "@/lib/nodeAnchorMenus";
import type { AnchorMenuGraphContext } from "@/lib/nodeAnchorMenus";

export function isAnchorPartnerOfferedForKind(
  anchorType: string,
  direction: "incoming" | "outgoing",
  partnerKey: CreationKind,
): boolean {
  const allowed =
    direction === "incoming"
      ? isConnectionAllowed(partnerKey, anchorType)
      : isConnectionAllowed(anchorType, partnerKey);
  if (!allowed) return false;
  if (anchorType === "ffmpegConcat" && partnerKey === "ffmpegConcat") return false;
  if (anchorType === "scriptNode" && partnerKey === "scriptNode") return false;
  if (anchorType === "textNode" && partnerKey === "textNode") return false;
  return true;
}

const MENU_EXTRA_KEYS = new Set<AnchorMenuKey>([
  "videoFirstLastSetup",
  "videoFirstFrameSetup",
  "audioTts",
  "imageI2iImport",
]);

function hasIncomingFromType(
  edges: Edge[],
  nodes: Node<FlowNodeData>[],
  targetId: string,
  sourceType: string,
): boolean {
  const prev = edges
    .filter((e) => !isEdgeDisabled(e) && e.target === targetId)
    .map((e) => e.source);
  return prev.some((sid) => nodes.find((n) => n.id === sid)?.type === sourceType);
}

function hasOutgoingToType(
  edges: Edge[],
  nodes: Node<FlowNodeData>[],
  sourceId: string,
  targetType: string,
): boolean {
  const next = edges
    .filter((e) => !isEdgeDisabled(e) && e.source === sourceId)
    .map((e) => e.target);
  return next.some((tid) => nodes.find((n) => n.id === tid)?.type === targetType);
}

/** P3：结合当前图状态，判断菜单项是否应展示（避免点选后 validate 失败） */
export function isAnchorMenuRowAvailable(
  ctx: AnchorMenuGraphContext,
  anchorType: string,
  direction: "incoming" | "outgoing",
  key: AnchorMenuKey,
): boolean {
  if (MENU_EXTRA_KEYS.has(key)) return true;

  if (!isAnchorPartnerOfferedForKind(anchorType, direction, key as CreationKind)) {
    return false;
  }

  const partner = key as CreationKind;
  const { anchorNodeId, nodes, edges } = ctx;

  if (anchorType === "scriptNode" && partner === "scriptNode") return false;
  if (anchorType === "textNode" && partner === "textNode") return false;

  if (anchorType === "textNode") {
    if (direction === "outgoing") {
      if (partner === "videoNode" && hasOutgoingToType(edges, nodes, anchorNodeId, "videoNode")) {
        return false;
      }
      if (partner === "audioNode" && hasOutgoingToType(edges, nodes, anchorNodeId, "audioNode")) {
        return false;
      }
    }
    if (direction === "incoming") {
      if (partner === "imageNode" && hasIncomingFromType(edges, nodes, anchorNodeId, "imageNode")) {
        return false;
      }
      if (partner === "videoNode" && hasIncomingFromType(edges, nodes, anchorNodeId, "videoNode")) {
        return false;
      }
      if (partner === "scriptNode" && hasIncomingFromType(edges, nodes, anchorNodeId, "scriptNode")) {
        return false;
      }
    }
  }

  if (
    direction === "incoming" &&
    partner === "scriptNode" &&
    anchorType &&
    ["imageNode", "imageAsset", "videoNode", "textNode", "audioNode"].includes(anchorType) &&
    countIncomingScriptUpstreams(nodes, edges, anchorNodeId) >= 1
  ) {
    return false;
  }

  if (direction === "incoming" && partner === "llm") {
    return isConnectionAllowed("llm", anchorType);
  }

  return true;
}

export function applyAnchorMenuGraphFilter(
  rows: { key: AnchorMenuKey; label: string }[],
  anchorType: string | undefined,
  direction: "incoming" | "outgoing",
  ctx?: AnchorMenuGraphContext,
): { key: AnchorMenuKey; label: string }[] {
  if (!anchorType || !ctx) return rows;
  return rows.filter((row) => isAnchorMenuRowAvailable(ctx, anchorType, direction, row.key));
}
