import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData, StoryboardShot } from "@/lib/types";
import { normalizeScriptBeats } from "@/lib/scriptBeatHelpers";
import {
  collectBeatIdsFromGroupMembers,
  getGroupMemberIdSet,
  getGroupMemberNodes,
  isStoryboardGroup,
  resolveGroupLinkedScriptNodeId,
} from "@/lib/canvasGroupStoryboard";
import {
  loadHermesAutoChainSettings,
  resolveHermesBatchSplitSettings,
} from "@/lib/hermes/hermesAutoChainPolicy";
import {
  buildScriptBeatChain,
  formatChainBuildStatus,
} from "@/lib/scriptBeatChainBuild";
import { batchGenerateImagesForStoryboard, findImageNodesForScript } from "@/lib/storyboard/batchGenerateImages";
import { getAgentMaxConcurrentMedia } from "@/lib/hermes/agent/hermesAgentSettings";
import { createBeatReferenceResolver } from "@/lib/projectBible/resolveBeatRefsForBatch";
import { useProjectBibleStore } from "@/store/projectBibleStore";

export type GroupHermesImagesVerdict =
  | { ok: true; scriptNodeId: string; beatIds: string[]; readyShotCount: number }
  | { ok: false; message: string };

function readyStoryboardShots(shots: StoryboardShot[] | undefined): StoryboardShot[] {
  return (shots ?? []).filter((s) => s.status === "generated" && Boolean(s.visualPrompt?.trim()));
}

/** 组内 Hermes 出图所覆盖的镜头 id（优先分镜组绑定 > 组内节点绑定 > 全局 Hermes 范围） */
export function resolveGroupHermesBeatIds(
  group: Node<FlowNodeData>,
  scriptNode: Node<FlowNodeData>,
  nodes: Node<FlowNodeData>[],
  groupId: string,
  readyShots: StoryboardShot[],
): string[] {
  const readyIds = new Set(readyShots.map((s) => s.scriptBeatId));

  if (isStoryboardGroup(group) && group.data.groupScriptBeatIds?.length) {
    return group.data.groupScriptBeatIds.filter((id) => readyIds.has(id));
  }

  const memberBeatIds = collectBeatIdsFromGroupMembers(getGroupMemberNodes(nodes, groupId));
  if (memberBeatIds.length > 0) {
    return memberBeatIds.filter((id) => readyIds.has(id));
  }

  const settings = loadHermesAutoChainSettings();
  if (settings.scope === "selected_only" && scriptNode.data.scriptBeatSelection?.length) {
    const sel = new Set(scriptNode.data.scriptBeatSelection);
    return readyShots.filter((s) => sel.has(s.scriptBeatId)).map((s) => s.scriptBeatId);
  }

  return readyShots.map((s) => s.scriptBeatId);
}

export function evaluateGroupHermesImages(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  groupId: string,
): GroupHermesImagesVerdict {
  const group = nodes.find((n) => n.id === groupId && n.type === "group");
  if (!group) return { ok: false, message: "未找到分组节点" };

  const scriptNodeId =
    group.data.groupScriptNodeId?.trim() ||
    resolveGroupLinkedScriptNodeId(nodes, edges, groupId);
  if (!scriptNodeId) {
    return {
      ok: false,
      message: "请先将脚本放入组内，或由脚本连线到组内节点后再出图",
    };
  }

  const scriptNode = nodes.find((n) => n.id === scriptNodeId && n.type === "scriptNode");
  if (!scriptNode) return { ok: false, message: "未找到关联的脚本节点" };

  const readyShots = readyStoryboardShots(scriptNode.data.storyboardShots);
  if (readyShots.length === 0) {
    return { ok: false, message: "请先在脚本中生成镜头分镜文案（状态为已生成）" };
  }

  const beatIds = resolveGroupHermesBeatIds(group, scriptNode, nodes, groupId, readyShots);
  if (beatIds.length === 0) {
    return {
      ok: false,
      message: "组内没有已就绪的镜头（请检查分镜组绑定或脚本勾选范围）",
    };
  }

  return {
    ok: true,
    scriptNodeId,
    beatIds,
    readyShotCount: beatIds.length,
  };
}

export type RunGroupHermesImagesDeps = {
  getNodes: () => Node<FlowNodeData>[];
  getEdges: () => Edge[];
  getProjectPath: () => string | null;
  setStatusText: (t: string) => void;
  updateNodeData: (id: string, patch: Partial<FlowNodeData>) => void;
  addNodesWithEdges: (nodes: Node<FlowNodeData>[], edges: Edge[]) => void;
  fitGroupAfterMemberChange: (nodes: Node<FlowNodeData>[], groupId: string) => Node<FlowNodeData>[];
};

/**
 * 组级 Hermes 一键出图：组内补建图片节点（若缺失）+ 按 Hermes 拆镜策略批量提交文生图。
 */
export async function runGroupHermesImages(
  groupId: string,
  deps: RunGroupHermesImagesDeps,
): Promise<void> {
  const projectPath = deps.getProjectPath()?.trim();
  if (!projectPath) {
    deps.setStatusText("请先打开工程后再使用 Hermes 出图");
    return;
  }

  const nodes = deps.getNodes();
  const edges = deps.getEdges();
  const verdict = evaluateGroupHermesImages(nodes, edges, groupId);
  if (!verdict.ok) {
    deps.setStatusText(verdict.message);
    return;
  }

  const group = nodes.find((n) => n.id === groupId)!;
  const scriptNode = nodes.find((n) => n.id === verdict.scriptNodeId)!;
  const beatsNorm = normalizeScriptBeats(scriptNode.data.scriptBeats ?? []);
  const shots = scriptNode.data.storyboardShots;
  const restrict = getGroupMemberIdSet(nodes, groupId);

  const chainResult = buildScriptBeatChain({
    scriptNodeId: verdict.scriptNodeId,
    anchor: group,
    beats: beatsNorm,
    scriptBeatSelection: verdict.beatIds,
    shots,
    nodes,
    edges,
    kinds: ["image"],
    skipExisting: true,
    storyboardGroupId: groupId,
  });

  if ("message" in chainResult) {
    deps.setStatusText(chainResult.message);
    return;
  }

  let latestNodes = nodes;
  let latestEdges = edges;
  if (chainResult.newNodes.length > 0) {
    deps.addNodesWithEdges(chainResult.newNodes, chainResult.newEdges);
    latestNodes = deps.fitGroupAfterMemberChange(deps.getNodes(), groupId);
    latestEdges = deps.getEdges();
    deps.setStatusText(formatChainBuildStatus(chainResult));
  }

  const imageByBeat = findImageNodesForScript(
    verdict.scriptNodeId,
    latestNodes,
    latestEdges,
    { restrictToNodeIds: restrict },
  );
  const missing = verdict.beatIds.filter((id) => !imageByBeat.has(id));
  if (missing.length > 0) {
    deps.setStatusText(
      `Hermes 出图：仍有 ${missing.length} 个镜头缺少组内图片节点，请检查脚本连线`,
    );
    return;
  }

  const nodeParams =
    scriptNode.data.params && typeof scriptNode.data.params === "object"
      ? (scriptNode.data.params as Record<string, unknown>)
      : undefined;
  const split = resolveHermesBatchSplitSettings(loadHermesAutoChainSettings(), nodeParams);

  const bible = useProjectBibleStore.getState().bible;
  await batchGenerateImagesForStoryboard({
    scriptNodeId: verdict.scriptNodeId,
    nodes: deps.getNodes(),
    edges: deps.getEdges(),
    projectPath,
    updateNodeData: deps.updateNodeData,
    setStatusText: deps.setStatusText,
    beatIds: verdict.beatIds,
    restrictToNodeIds: restrict,
    resolveBeatReferencePaths: createBeatReferenceResolver(beatsNorm, bible),
    maxConcurrent: getAgentMaxConcurrentMedia(),
    hermesBatch: {
      strategy: split.batchSplitStrategy,
      packImageCount: split.packImageCount,
      beats: beatsNorm,
      shots,
    },
  });
}
