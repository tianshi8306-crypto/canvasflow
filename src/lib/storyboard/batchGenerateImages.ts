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
import { runPool } from "@/lib/async/runPool";

export { findImageNodesForScript } from "@/lib/storyboard/storyboardMediaNodes";

export type BatchImageResult = { started: number; skipped: number; failed: number };

type ImageJob = {
  beatId: string;
  imageNodeId: string;
  imageCount?: number;
};

type ImageJobOutcome = "started" | "skipped" | "failed";

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
  /** 分镜组：仅处理该集合内的图片节点 */
  restrictToNodeIds?: ReadonlySet<string>;
  skipIfHasImage?: boolean;
  /** Hermes 排队出图：启用打包拆镜任务规划 */
  hermesBatch?: HermesBatchImageOptions;
  /** Hermes @参考素材：prepend 到各任务 referenceImagePaths（图生图） */
  referenceImagePathsPrefix?: string[];
  /** 按镜头合并角色参考（镜头表 / 项目圣经） */
  resolveBeatReferencePaths?: (beatId: string) => string[];
  /** Hermes 任务轨：批量进度 */
  onProgress?: (current: number, total: number, detail?: string) => void;
  /** 镜级并发上限（1～3）；默认 1 为顺序提交 */
  maxConcurrent?: number;
}): Promise<BatchImageResult> {
  const {
    scriptNodeId,
    nodes,
    edges,
    projectPath,
    updateNodeData,
    setStatusText,
    beatIds,
    restrictToNodeIds,
    skipIfHasImage = true,
    hermesBatch,
    referenceImagePathsPrefix,
    resolveBeatReferencePaths,
    onProgress,
    maxConcurrent = 1,
  } = opts;
  const refPrefix = (referenceImagePathsPrefix ?? [])
    .map((p) => p.trim())
    .filter(Boolean);

  const imageByBeat = findImageNodesForScript(scriptNodeId, nodes, edges, {
    restrictToNodeIds,
  });
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
        restrictToNodeIds,
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

  onProgress?.(0, jobs.length, "准备");

  if (hermesBatch) {
    setStatusText(
      formatHermesBatchPlanHint(hermesBatch.strategy, hermesBatch.packImageCount, jobs.length) +
        (maxConcurrent > 1 ? ` · 并发 ${maxConcurrent} 镜` : ""),
    );
  } else if (maxConcurrent > 1) {
    setStatusText(`批量出图：${jobs.length} 个任务，并发 ${maxConcurrent} 镜`);
  }

  const runOneJob = async (job: ImageJob): Promise<ImageJobOutcome> => {
    const { beatId, imageNodeId, imageCount: jobCount } = job;
    const latestNodes = useProjectStore.getState().nodes;
    const latestEdges = useProjectStore.getState().edges;

    const prepared = await prepareImageGenerationRun(
      latestNodes,
      latestEdges,
      imageNodeId,
      projectPath,
    );
    if (!prepared.ok) {
      patchStoryboardShot(scriptNodeId, beatId, { status: "failed", error: prepared.reason }, updateNodeData);
      return "skipped";
    }

    patchStoryboardShot(scriptNodeId, beatId, { status: "generating", error: undefined }, updateNodeData);

    const beatRefs = resolveBeatReferencePaths?.(beatId) ?? [];
    const mergedRefs = [...refPrefix, ...beatRefs, ...prepared.prepared.input.referenceImagePaths].filter(
      (p, i, arr) => p.trim() && arr.indexOf(p) === i,
    );
    const baseInput =
      jobCount != null && jobCount >= 1
        ? { ...prepared.prepared.input, count: Math.min(4, Math.max(1, jobCount)) }
        : prepared.prepared.input;
    const input = {
      ...baseInput,
      referenceImagePaths: mergedRefs.slice(0, 4),
      ...(mergedRefs.length > 0 ? { task: "image_to_image" as const } : {}),
    };

    try {
      await runNodeTaskAgent(imageGenerationAgentRuntime, input, {
        nodeId: imageNodeId,
        projectPath,
        updateNodeData,
        setStatusText,
      });
      return "started";
    } catch {
      patchStoryboardShot(
        scriptNodeId,
        beatId,
        { status: "failed", error: "批量图片生成失败" },
        updateNodeData,
      );
      return "failed";
    }
  };

  let completedJobs = 0;
  const outcomes = await runPool(jobs, maxConcurrent, async (job) => {
    const outcome = await runOneJob(job);
    completedJobs += 1;
    const beatNum = useProjectStore
      .getState()
      .nodes.find((n) => n.id === scriptNodeId)
      ?.data.scriptBeats?.find((b) => b.id === job.beatId)
      ?.shotNumber?.trim();
    onProgress?.(completedJobs, jobs.length, beatNum ? `镜 ${beatNum}` : undefined);
    return outcome;
  });

  for (const outcome of outcomes) {
    if (outcome === "started") started += 1;
    else if (outcome === "skipped") skipped += 1;
    else if (outcome === "failed") failed += 1;
  }

  setStatusText(
    `批量图片：已提交 ${started} 个` +
      (skipped ? `，跳过 ${skipped}` : "") +
      (failed ? `，失败 ${failed}` : ""),
  );
  return { started, skipped, failed };
}
