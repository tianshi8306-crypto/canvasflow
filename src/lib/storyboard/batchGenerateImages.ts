import type { Node } from "@xyflow/react";
import type { FlowNodeData, ScriptBeat, StoryboardShot } from "@/lib/types";
import { prepareImageGenerationRun } from "@/lib/imageGeneration/prepareImageGenerationRun";
import { runNodeTaskAgent } from "@/lib/nodeAgentRuntime/runNodeTaskAgent";
import { imageGenerationAgentRuntime } from "@/lib/nodeAgentRuntime/imageGenerationAgent";
import { useProjectStore } from "@/store/projectStore";
import { findImageNodesForScript } from "@/lib/storyboard/storyboardMediaNodes";
import { patchStoryboardShot } from "@/lib/storyboard/patchStoryboardShot";
import type { HermesBatchSplitStrategy } from "@/lib/hermes/hermesAutoChainPolicy";
import {
  formatHermesBatchPlanHint,
  planHermesBatchImageJobs,
} from "@/lib/hermes/hermesBatchSplitStrategy";

export { findImageNodesForScript } from "@/lib/storyboard/storyboardMediaNodes";

export type BatchImageResult = { started: number; skipped: number; failed: number };

export type HermesBatchImageOptions = {
  strategy: HermesBatchSplitStrategy;
  packImageCount: number;
  beats: ScriptBeat[];
  shots: StoryboardShot[] | undefined;
};

/**
 * 对已创建且绑定 scriptBeatId 的图片节点顺序提交文生图/图生图。
 */
export async function batchGenerateImagesForStoryboard(opts: {
  scriptNodeId: string;
  nodes: Node<FlowNodeData>[];
  edges: { source: string; target: string }[];
  projectPath: string;
  updateNodeData: (id: string, patch: Partial<FlowNodeData>) => void;
  setStatusText: (t: string) => void;
  beatIds?: string[];
  skipIfHasImage?: boolean;
  /** Hermes 排队出图：启用打包拆镜任务规划 */
  hermesBatch?: HermesBatchImageOptions;
}): Promise<BatchImageResult> {
  const {
    scriptNodeId,
    nodes,
    edges,
    projectPath,
    updateNodeData,
    setStatusText,
    beatIds,
    skipIfHasImage = true,
    hermesBatch,
  } = opts;

  const imageByBeat = findImageNodesForScript(scriptNodeId, nodes, edges);
  const beatFilter = beatIds?.length ? new Set(beatIds) : null;

  let started = 0;
  let skipped = 0;
  let failed = 0;

  const jobs = hermesBatch
    ? planHermesBatchImageJobs({
        strategy: hermesBatch.strategy,
        packImageCount: hermesBatch.packImageCount,
        scriptNodeId,
        beatIds,
        beats: hermesBatch.beats,
        shots: hermesBatch.shots,
        nodes,
        edges,
        skipIfHasImage,
      })
    : [...imageByBeat.entries()]
        .filter(([beatId, imageNodeId]) => {
          if (beatFilter && !beatFilter.has(beatId)) return false;
          const n = nodes.find((x) => x.id === imageNodeId);
          if (!n) return false;
          if (skipIfHasImage && (n.data.path?.trim() || n.data.assetId?.trim())) return false;
          return true;
        })
        .map(([beatId, imageNodeId]) => ({
          beatId,
          imageNodeId,
          imageCount: undefined as number | undefined,
        }));

  if (jobs.length === 0) {
    setStatusText("没有可批量生成的图片（需已创建图片节点、已绑定镜头，且节点尚无成片）");
    return { started: 0, skipped: imageByBeat.size, failed: 0 };
  }

  if (hermesBatch) {
    setStatusText(
      formatHermesBatchPlanHint(hermesBatch.strategy, hermesBatch.packImageCount, jobs.length),
    );
  }

  for (let jobIndex = 0; jobIndex < jobs.length; jobIndex++) {
    const { beatId, imageNodeId, imageCount: jobCount } = jobs[jobIndex]!;
    const latestNodes = useProjectStore.getState().nodes;
    const latestEdges = useProjectStore.getState().edges;

    const prepared = await prepareImageGenerationRun(
      latestNodes,
      latestEdges,
      imageNodeId,
      projectPath,
    );
    if (!prepared.ok) {
      skipped += 1;
      patchStoryboardShot(scriptNodeId, beatId, { status: "failed", error: prepared.reason }, updateNodeData);
      continue;
    }

    patchStoryboardShot(scriptNodeId, beatId, { status: "generating", error: undefined }, updateNodeData);

    const input =
      jobCount != null && jobCount >= 1
        ? { ...prepared.prepared.input, count: Math.min(4, Math.max(1, jobCount)) }
        : prepared.prepared.input;

    try {
      await runNodeTaskAgent(imageGenerationAgentRuntime, input, {
        nodeId: imageNodeId,
        projectPath,
        updateNodeData,
        setStatusText,
      });
      started += 1;
    } catch {
      failed += 1;
      patchStoryboardShot(
        scriptNodeId,
        beatId,
        { status: "failed", error: "批量图片生成失败" },
        updateNodeData,
      );
    }
  }

  setStatusText(
    `批量图片：已提交 ${started} 个` +
      (skipped ? `，跳过 ${skipped}` : "") +
      (failed ? `，失败 ${failed}` : ""),
  );
  return { started, skipped, failed };
}
