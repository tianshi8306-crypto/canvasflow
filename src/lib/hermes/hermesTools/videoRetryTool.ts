import { isTauri } from "@tauri-apps/api/core";
import type { HermesPlanStep } from "@/lib/hermes/hermesDirectorTypes";
import type { HermesToolRunResult } from "@/lib/hermes/hermesDirectorTypes";
import { findPrimaryScriptNode } from "@/lib/hermes/hermesCanvasContext";
import { resolveToolBeatIds } from "@/lib/hermes/hermesTools/toolBeatIds";
import { batchGenerateVideosForStoryboard } from "@/lib/storyboard/batchGenerateVideos";
import { listFailedVideoBeatIds } from "@/lib/storyboard/scriptProductionExport";
import { DESKTOP_SHELL_HINT } from "@/lib/tauriEnv";
import { createHermesBatchProgressReporter } from "@/lib/hermes/hermesBatchTaskTrack";
import { getAgentMaxConcurrentMedia } from "@/lib/hermes/agent/hermesAgentSettings";
import { useProjectStore } from "@/store/projectStore";

/**
 * Hermes：仅重试 storyboardShots.videoStatus === "failed" 的镜头。
 */
export async function runVideoRetryFailedTool(
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

  const shots = scriptNode.data.storyboardShots ?? [];
  const failedIds = listFailedVideoBeatIds(shots);
  if (failedIds.length === 0) {
    return { ok: false, message: "当前没有失败的视频镜头", scriptNodeId };
  }

  const explicitBeatIds = resolveToolBeatIds(scriptNodeId, step.args, opts.sourceMessage);
  const targetBeatIds = explicitBeatIds?.length
    ? failedIds.filter((id) => explicitBeatIds.includes(id))
    : failedIds;

  if (targetBeatIds.length === 0) {
    return {
      ok: false,
      message: explicitBeatIds?.length
        ? "指定镜号中没有失败的视频任务"
        : "没有可重试的失败视频",
      scriptNodeId,
    };
  }

  state.setStatusText(`Hermes：重试 ${targetBeatIds.length} 个失败视频镜头…`);

  const latest = useProjectStore.getState();
  const latestScript = latest.nodes.find((n) => n.id === scriptNodeId)!;

  const batch = await batchGenerateVideosForStoryboard({
    scriptNodeId,
    beats: latestScript.data.scriptBeats ?? [],
    shots: latestScript.data.storyboardShots ?? shots,
    nodes: latest.nodes,
    edges: latest.edges,
    projectPath,
    updateNodeData: latest.updateNodeData,
    setStatusText: latest.setStatusText,
    beatIds: targetBeatIds,
    autoComposePreview: false,
    onProgress: batchTrack.onProgress,
    maxConcurrent: getAgentMaxConcurrentMedia(),
  });

  if (batch.started === 0) {
    batchTrack.finish(false);
    return {
      ok: false,
      message:
        "失败镜头暂无法重试（可能缺分镜图、无视频节点或 draft.prompt；可先执行「分镜转视频提示词」）",
      scriptNodeId,
    };
  }

  batchTrack.finish(batch.failed === 0 || batch.started > 0);
  return {
    ok: true,
    message: `已重试提交 ${batch.started} 个失败视频（跳过 ${batch.skipped}，本次失败 ${batch.failed}）`,
    scriptNodeId,
  };
}
