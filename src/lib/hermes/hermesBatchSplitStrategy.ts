import type { Node } from "@xyflow/react";
import type { FlowNodeData, ScriptBeat, StoryboardShot } from "@/lib/types";
import { normalizeScriptBeats } from "@/lib/scriptBeatHelpers";
import {
  clampHermesPackImageCount,
  type HermesBatchSplitStrategy,
} from "@/lib/hermes/hermesAutoChainPolicy";
import {
  findImageNodesForScript,
  shotHasGeneratedImage,
} from "@/lib/storyboard/storyboardMediaNodes";
import { normalizeImageGenerationCount } from "@/lib/imageGeneration/catalog";

export type HermesBatchImageJob = {
  beatId: string;
  imageNodeId: string;
  imageCount: number;
};

function readImageCountFromNode(nodes: Node<FlowNodeData>[], imageNodeId: string): number {
  const node = nodes.find((n) => n.id === imageNodeId);
  const params =
    node?.data.params && typeof node.data.params === "object" && !Array.isArray(node.data.params)
      ? (node.data.params as Record<string, unknown>)
      : {};
  const raw = params.imageCount;
  return normalizeImageGenerationCount(raw);
}

function beatHasGeneratedImage(
  beatId: string,
  shots: StoryboardShot[] | undefined,
  nodes: Node<FlowNodeData>[],
  imageByBeat: Map<string, string>,
  skipIfHasImage: boolean,
): boolean {
  if (!skipIfHasImage) return false;
  const shot = (shots ?? []).find((s) => s.scriptBeatId === beatId);
  const imageNode = nodes.find((n) => n.id === imageByBeat.get(beatId));
  return shotHasGeneratedImage(beatId, shot, imageNode);
}

/**
 * 规划 Hermes 批量出图任务序列（含 pack_forward 打包拆镜）。
 */
export function planHermesBatchImageJobs(opts: {
  strategy: HermesBatchSplitStrategy;
  packImageCount: number;
  scriptNodeId: string;
  beatIds: string[] | undefined;
  beats: ScriptBeat[];
  shots: StoryboardShot[] | undefined;
  nodes: Node<FlowNodeData>[];
  edges: { source: string; target: string }[];
  skipIfHasImage?: boolean;
  restrictToNodeIds?: ReadonlySet<string>;
}): HermesBatchImageJob[] {
  const skipIfHasImage = opts.skipIfHasImage !== false;
  const pack = clampHermesPackImageCount(opts.packImageCount);
  const imageByBeat = findImageNodesForScript(opts.scriptNodeId, opts.nodes, opts.edges, {
    restrictToNodeIds: opts.restrictToNodeIds,
  });
  const beatFilter = opts.beatIds?.length ? new Set(opts.beatIds) : null;

  const orderedBeatIds = normalizeScriptBeats(opts.beats)
    .map((b) => b.id)
    .filter((id) => !beatFilter || beatFilter.has(id));

  const hasImage = (beatId: string) =>
    beatHasGeneratedImage(beatId, opts.shots, opts.nodes, imageByBeat, skipIfHasImage);

  if (opts.strategy === "per_beat") {
    const jobs: HermesBatchImageJob[] = [];
    for (const beatId of orderedBeatIds) {
      const imageNodeId = imageByBeat.get(beatId);
      if (!imageNodeId || hasImage(beatId)) continue;
      jobs.push({
        beatId,
        imageNodeId,
        imageCount: readImageCountFromNode(opts.nodes, imageNodeId),
      });
    }
    return jobs;
  }

  const jobs: HermesBatchImageJob[] = [];
  let i = 0;
  while (i < orderedBeatIds.length) {
    const beatId = orderedBeatIds[i]!;
    const imageNodeId = imageByBeat.get(beatId);
    if (!imageNodeId || hasImage(beatId)) {
      i += 1;
      continue;
    }

    let vacantAhead = 0;
    for (let j = i + 1; j < orderedBeatIds.length; j++) {
      const nextId = orderedBeatIds[j]!;
      if (!imageByBeat.has(nextId)) continue;
      if (hasImage(nextId)) continue;
      vacantAhead += 1;
    }

    if (vacantAhead > 0 && pack > 1) {
      const fillSlots = Math.min(vacantAhead, pack - 1);
      jobs.push({ beatId, imageNodeId, imageCount: pack });
      i += 1 + fillSlots;
    } else {
      jobs.push({ beatId, imageNodeId, imageCount: 1 });
      i += 1;
    }
  }
  return jobs;
}

export function formatHermesBatchPlanHint(
  strategy: HermesBatchSplitStrategy,
  packImageCount: number,
  jobCount: number,
): string {
  if (jobCount === 0) return "无可提交的批量出图任务";
  const mode =
    strategy === "pack_forward"
      ? `打包拆镜 ${packImageCount} 张`
      : "逐镜出图";
  return `Hermes 批量出图（${mode}）：${jobCount} 次任务`;
}
