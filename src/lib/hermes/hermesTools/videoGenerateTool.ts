import { isTauri } from "@tauri-apps/api/core";
import type { HermesPlanStep } from "@/lib/hermes/hermesDirectorTypes";
import type { HermesToolRunResult } from "@/lib/hermes/hermesDirectorTypes";
import { findPrimaryScriptNode } from "@/lib/hermes/hermesCanvasContext";
import { handleScriptNodeCompleted } from "@/lib/hermes/autoChain";
import { resolveToolBeatIds } from "@/lib/hermes/hermesTools/toolBeatIds";
import { batchGenerateVideosForStoryboard } from "@/lib/storyboard/batchGenerateVideos";
import {
  assessBatchVideoReadiness,
  formatBatchVideoReadinessHint,
} from "@/lib/storyboard/scriptProductionExport";
import { DESKTOP_SHELL_HINT } from "@/lib/tauriEnv";
import { createHermesBatchProgressReporter } from "@/lib/hermes/hermesBatchTaskTrack";
import { getAgentMaxConcurrentMedia } from "@/lib/hermes/agent/hermesAgentSettings";
import { useProjectStore } from "@/store/projectStore";

/**
 * Hermes：批量提交视频 Agent（复用脚本工作台 batchGenerateVideos）。
 */
export async function runVideoGenerateTool(
  step: HermesPlanStep,
  opts: { sourceMessage: string; scriptNodeId?: string | null; directorStepId?: string },
): Promise<HermesToolRunResult> {
  const batchTrack = createHermesBatchProgressReporter(
    opts.directorStepId ?? step.id,
    "video",
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
    opts.scriptNodeId?.trim() ||
    findPrimaryScriptNode(state.nodes)?.id ||
    null;
  if (!scriptNodeId) {
    return { ok: false, message: "请先在画布上创建脚本节点" };
  }

  const scriptNode = state.nodes.find((n) => n.id === scriptNodeId && n.type === "scriptNode");
  if (!scriptNode) {
    return { ok: false, message: "未找到脚本节点" };
  }

  const beatIds = resolveToolBeatIds(scriptNodeId, step.args, opts.sourceMessage);
  const beats = scriptNode.data.scriptBeats ?? [];
  const shots = scriptNode.data.storyboardShots ?? [];

  let readiness = assessBatchVideoReadiness({
    scriptNodeId,
    beats,
    shots,
    nodes: state.nodes,
    edges: state.edges,
    scriptBeatSelection: beatIds,
  });

  if (!("canStart" in readiness)) {
    return { ok: false, message: readiness.message, scriptNodeId };
  }

  if (!readiness.canStart && (readiness.skipCounts.no_video_node ?? 0) > 0) {
    const chain = handleScriptNodeCompleted(scriptNodeId, beatIds ? { beatIds } : undefined);
    if (chain.succeeded > 0) {
      state.setStatusText(`Hermes：已建链 ${chain.succeeded} 镜，继续检查视频就绪…`);
    }
    const fresh = useProjectStore.getState();
    const freshScript = fresh.nodes.find((n) => n.id === scriptNodeId);
    readiness = assessBatchVideoReadiness({
      scriptNodeId,
      beats: freshScript?.data.scriptBeats ?? beats,
      shots: freshScript?.data.storyboardShots ?? shots,
      nodes: fresh.nodes,
      edges: fresh.edges,
      scriptBeatSelection: beatIds,
    });
  }

  if (!("canStart" in readiness)) {
    return { ok: false, message: readiness.message, scriptNodeId };
  }
  if (!readiness.canStart) {
    return {
      ok: false,
      message: readiness.blockMessage || "没有可提交批量视频的镜头",
      scriptNodeId,
    };
  }

  state.setStatusText(`Hermes：${formatBatchVideoReadinessHint(readiness)}，开始提交…`);

  const latest = useProjectStore.getState();
  const latestScript = latest.nodes.find((n) => n.id === scriptNodeId)!;

  const batch = await batchGenerateVideosForStoryboard({
    scriptNodeId,
    beats: latestScript.data.scriptBeats ?? [],
    shots: latestScript.data.storyboardShots ?? [],
    nodes: latest.nodes,
    edges: latest.edges,
    projectPath,
    updateNodeData: latest.updateNodeData,
    setStatusText: latest.setStatusText,
    beatIds,
    autoComposePreview: false,
    onProgress: batchTrack.onProgress,
    maxConcurrent: getAgentMaxConcurrentMedia(),
  });

  if (batch.started === 0) {
    batchTrack.finish(false);
    const hint =
      batch.skipped > 0
        ? "范围内镜头均跳过（可能缺分镜图、无视频草稿 prompt 或已在生成中）"
        : "没有可提交的视频任务";
    return { ok: false, message: hint, scriptNodeId };
  }

  batchTrack.finish(batch.failed === 0 || batch.started > 0);
  return {
    ok: true,
    message: `视频任务：已提交 ${batch.started} 个（跳过 ${batch.skipped}，失败 ${batch.failed}）。成片合成可在视频就绪后说「导出成片」`,
    scriptNodeId,
  };
}
