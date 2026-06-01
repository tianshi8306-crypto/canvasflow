import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData, GroupNodeKind } from "@/lib/types";
import { collectGroupDescendantIds, findAncestorGroup } from "@/lib/canvasGroup";
import { getScriptBeatIdFromParams } from "@/lib/incomingScriptBinding";
import { enabledTargetsFromSource } from "@/lib/edgeState";

const STORYBOARD_MEMBER_TYPES = new Set([
  "imageNode",
  "videoNode",
  "scriptNode",
  "textNode",
  "audioNode",
]);

const STORYBOARD_MEDIA_TYPES = new Set(["imageNode", "videoNode"]);

export function isStoryboardGroup(
  node: Node<FlowNodeData> | undefined,
): node is Node<FlowNodeData> {
  return node?.type === "group" && node.data.groupKind === "storyboard";
}

export function getGroupMemberNodes(
  nodes: Node<FlowNodeData>[],
  groupId: string,
): Node<FlowNodeData>[] {
  const ids = collectGroupDescendantIds(nodes, groupId);
  return nodes.filter((n) => ids.has(n.id));
}

export function getGroupMemberIdSet(nodes: Node<FlowNodeData>[], groupId: string): Set<string> {
  return collectGroupDescendantIds(nodes, groupId);
}

/** 解析与组关联的脚本节点（组内 script 或组外连线） */
export function resolveGroupLinkedScriptNodeId(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  groupId: string,
): string | null {
  const memberIds = getGroupMemberIdSet(nodes, groupId);
  const inside = nodes.find((n) => memberIds.has(n.id) && n.type === "scriptNode");
  if (inside) return inside.id;

  for (const e of edges) {
    const src = nodes.find((n) => n.id === e.source);
    const tgt = nodes.find((n) => n.id === e.target);
    if (memberIds.has(e.target) && src?.type === "scriptNode") return src.id;
    if (memberIds.has(e.source) && tgt?.type === "scriptNode") return tgt.id;
  }
  return null;
}

export function collectBeatIdsFromGroupMembers(members: Node<FlowNodeData>[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of members) {
    const beatId = getScriptBeatIdFromParams(n.data)?.trim();
    if (!beatId || seen.has(beatId)) continue;
    seen.add(beatId);
    out.push(beatId);
  }
  return out;
}

export type ConvertGroupToStoryboardVerdict =
  | {
      ok: true;
      scriptNodeId: string;
      beatIds: string[];
      mediaCount: number;
      memberCount: number;
    }
  | { ok: false; message: string };

export function evaluateConvertGroupToStoryboard(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  groupId: string,
): ConvertGroupToStoryboardVerdict {
  const group = nodes.find((n) => n.id === groupId && n.type === "group");
  if (!group) return { ok: false, message: "未找到分组节点" };

  const members = getGroupMemberNodes(nodes, groupId);
  if (members.length === 0) {
    return { ok: false, message: "组内没有节点，无法转为分镜组" };
  }

  const scriptNodeId = resolveGroupLinkedScriptNodeId(nodes, edges, groupId);
  if (!scriptNodeId) {
    return {
      ok: false,
      message: "请先将脚本节点放入组内，或由脚本连线到组内节点",
    };
  }

  const mediaCount = members.filter((n) => STORYBOARD_MEDIA_TYPES.has(n.type ?? "")).length;
  if (mediaCount === 0) {
    return { ok: false, message: "组内需要至少一个图片或视频节点" };
  }

  const allowedCount = members.filter((n) => STORYBOARD_MEMBER_TYPES.has(n.type ?? "")).length;
  if (allowedCount < members.length) {
    return { ok: false, message: "组内含有不支持分镜批次的节点类型" };
  }

  if (mediaCount / members.length < 0.5) {
    return { ok: false, message: "组内应以图片/视频节点为主（≥50%）" };
  }

  const scriptNode = nodes.find((n) => n.id === scriptNodeId);
  const beatIds = collectBeatIdsFromGroupMembers(members);
  const scriptBeats = scriptNode?.data.scriptBeats ?? [];
  const validBeatIds = new Set(scriptBeats.map((b) => b.id));
  const scopedBeatIds =
    beatIds.length > 0
      ? beatIds.filter((id) => validBeatIds.size === 0 || validBeatIds.has(id))
      : scriptNode?.data.scriptBeatSelection?.length
        ? scriptNode.data.scriptBeatSelection.filter((id) => validBeatIds.has(id))
        : [];

  return {
    ok: true,
    scriptNodeId,
    beatIds: scopedBeatIds,
    mediaCount,
    memberCount: members.length,
  };
}

export function groupKindLabel(kind: GroupNodeKind | undefined, memberCount: number): string {
  if (kind === "storyboard") {
    return memberCount > 0 ? `分镜组 · ${memberCount} 个节点` : "分镜组";
  }
  return memberCount > 0 ? `分组 · ${memberCount} 个节点` : "分组";
}

/** 脚本下游节点若位于分镜组，返回该组成员 id 集合供批次过滤 */
export function storyboardRestrictForNode(
  nodes: Node<FlowNodeData>[],
  nodeId: string,
): Set<string> | undefined {
  const group = findAncestorGroup(nodes, nodeId, isStoryboardGroup);
  if (!group) return undefined;
  return getGroupMemberIdSet(nodes, group.id);
}

/** 脚本节点下游若存在唯一分镜组，返回该组 id（供建链/批次限定范围） */
export function resolveUniqueStoryboardGroupForScript(
  scriptNodeId: string,
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
): string | null {
  const targets = enabledTargetsFromSource(edges, scriptNodeId);
  const groupIds = new Set<string>();
  for (const id of targets) {
    const group = findAncestorGroup(nodes, id, isStoryboardGroup);
    if (group) groupIds.add(group.id);
  }
  return groupIds.size === 1 ? [...groupIds][0]! : null;
}

export function storyboardBeatIdsForGroup(
  group: Node<FlowNodeData> | undefined,
): string[] | undefined {
  if (!isStoryboardGroup(group)) return undefined;
  const ids = group.data.groupScriptBeatIds?.filter(Boolean);
  return ids?.length ? ids : undefined;
}

export function scriptNodeHasStoryboardDownstream(
  scriptNodeId: string,
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
): boolean {
  const targets = enabledTargetsFromSource(edges, scriptNodeId);
  for (const id of targets) {
    if (findAncestorGroup(nodes, id, isStoryboardGroup)) return true;
  }
  return false;
}
