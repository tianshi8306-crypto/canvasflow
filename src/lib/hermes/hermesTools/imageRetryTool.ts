import { isTauri } from "@tauri-apps/api/core";
import type { HermesPlanStep, HermesToolRunResult } from "@/lib/hermes/hermesDirectorTypes";
import { findPrimaryScriptNode } from "@/lib/hermes/hermesCanvasContext";
import { resolveToolBeatIds } from "@/lib/hermes/hermesTools/toolBeatIds";
import {
  batchGenerateImagesForStoryboard,
  findImageNodesForScript,
} from "@/lib/storyboard/batchGenerateImages";
import { listFailedKeyframeBeatIds } from "@/lib/storyboard/scriptProductionExport";
import { createBeatReferenceResolver } from "@/lib/projectBible/resolveBeatRefsForBatch";
import {
  getGroupMemberIdSet,
  resolveUniqueStoryboardGroupForScript,
} from "@/lib/canvasGroupStoryboard";
import {
  loadHermesAutoChainSettings,
  resolveHermesBatchSplitSettings,
} from "@/lib/hermes/hermesAutoChainPolicy";
import { createHermesBatchProgressReporter } from "@/lib/hermes/hermesBatchTaskTrack";
import { getAgentMaxConcurrentMedia } from "@/lib/hermes/agent/hermesAgentSettings";
import { DESKTOP_SHELL_HINT } from "@/lib/tauriEnv";
import { useProjectBibleStore } from "@/store/projectBibleStore";
import { useProjectStore } from "@/store/projectStore";

/**
 * Hermes：仅重试 storyboardShots.status === failed 的关键帧出图（需已有图片节点）。
 */
export async function runImageRetryFailedTool(
  step: HermesPlanStep,
  opts: { sourceMessage: string; scriptNodeId?: string | null; directorStepId?: string },
): Promise<HermesToolRunResult> {
  const batchTrack = createHermesBatchProgressReporter(
    opts.directorStepId ?? step.id,
    "image",
    step.label,
  );
  if (!isTauri()) {
    return { ok: false, message: DESKTOP_SHELL_HINT };
  }

  const state = useProjectStore.getState();
  const projectPath = state.projectPath?.trim();
  if (!projectPath) {
    return { ok: false, message: "请先打开工程" };
  }

  const scriptNodeId =
    opts.scriptNodeId?.trim() || findPrimaryScriptNode(state.nodes)?.id || null;
  if (!scriptNodeId) {
    return { ok: false, message: "请先在画布上创建脚本节点" };
  }

  const scriptNode = state.nodes.find((n) => n.id === scriptNodeId && n.type === "scriptNode");
  if (!scriptNode) {
    return { ok: false, message: "未找到脚本节点" };
  }

  const shots = scriptNode.data.storyboardShots ?? [];
  const failedIds = listFailedKeyframeBeatIds(shots);
  if (failedIds.length === 0) {
    return { ok: false, message: "当前没有失败的关键帧出图任务", scriptNodeId };
  }

  const explicitBeatIds = resolveToolBeatIds(scriptNodeId, step.args, opts.sourceMessage);
  const targetBeatIds = explicitBeatIds?.length
    ? failedIds.filter((id) => explicitBeatIds.includes(id))
    : failedIds;

  if (targetBeatIds.length === 0) {
    return {
      ok: false,
      message: explicitBeatIds?.length
        ? "指定镜号中没有失败的关键帧任务"
        : "没有可重试的失败关键帧",
      scriptNodeId,
    };
  }

  const storyboardGroupId = resolveUniqueStoryboardGroupForScript(
    scriptNodeId,
    state.nodes,
    state.edges,
  );
  const restrictToNodeIds = storyboardGroupId
    ? getGroupMemberIdSet(state.nodes, storyboardGroupId)
    : undefined;
  const imageByBeat = findImageNodesForScript(scriptNodeId, state.nodes, state.edges, {
    restrictToNodeIds,
  });
  const beatIds = targetBeatIds.filter((id) => imageByBeat.has(id));
  const missingNodeCount = targetBeatIds.length - beatIds.length;

  if (beatIds.length === 0) {
    return {
      ok: false,
      message:
        missingNodeCount > 0
          ? "失败镜头尚无图片节点，请先说「批量出关键帧」或执行建链出图"
          : "没有可重试的失败关键帧",
      scriptNodeId,
    };
  }

  state.setStatusText(`Hermes：重试 ${beatIds.length} 个失败关键帧…`);

  const latest = useProjectStore.getState();
  const latestScript = latest.nodes.find((n) => n.id === scriptNodeId)!;
  const nodeParams =
    latestScript.data.params && typeof latestScript.data.params === "object"
      ? (latestScript.data.params as Record<string, unknown>)
      : undefined;
  const split = resolveHermesBatchSplitSettings(loadHermesAutoChainSettings(), nodeParams);
  const bible = useProjectBibleStore.getState().bible;
  const resolveBeatReferencePaths = createBeatReferenceResolver(
    latestScript.data.scriptBeats,
    bible,
  );

  const batch = await batchGenerateImagesForStoryboard({
    scriptNodeId,
    nodes: latest.nodes,
    edges: latest.edges,
    projectPath,
    updateNodeData: latest.updateNodeData,
    setStatusText: latest.setStatusText,
    beatIds,
    restrictToNodeIds,
    resolveBeatReferencePaths,
    onProgress: batchTrack.onProgress,
    maxConcurrent: getAgentMaxConcurrentMedia(),
    hermesBatch: {
      strategy: split.batchSplitStrategy,
      packImageCount: split.packImageCount,
      beats: latestScript.data.scriptBeats ?? [],
      shots: latestScript.data.storyboardShots ?? shots,
    },
  });

  if (batch.started === 0) {
    batchTrack.finish(false);
    return {
      ok: false,
      message:
        "失败镜头暂无法重试（可能缺图片节点、分镜文案未就绪或仍在生成中）",
      scriptNodeId,
    };
  }

  batchTrack.finish(batch.failed === 0 || batch.started > 0);
  let message = `已重试提交 ${batch.started} 个失败关键帧（跳过 ${batch.skipped}，本次失败 ${batch.failed}）`;
  if (missingNodeCount > 0) {
    message += `；另有 ${missingNodeCount} 镜无图片节点，需先建链`;
  }
  return { ok: true, message, scriptNodeId };
}
