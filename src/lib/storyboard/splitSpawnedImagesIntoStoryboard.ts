import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData, ScriptBeat, StoryboardShot } from "@/lib/types";
import { resolveStoryboardBeatScope } from "@/lib/scriptStoryboardScope";
import {
  findImageNodesForScript,
  shotHasGeneratedImage,
} from "@/lib/storyboard/storyboardMediaNodes";
import { writebackStoryboardShotImagePath } from "@/lib/storyboard/writebackStoryboardImage";

export type SplitShotBeatAssignment = {
  beatId: string;
  shotNumber: string;
};

/**
 * 多图宫格「拆镜入库」：从锚点镜头起，在分镜范围内按镜号顺序选取尚无分镜图的后续镜头。
 */
export function resolveVacantBeatsForSplitShots(opts: {
  scriptNodeId: string;
  anchorBeatId: string;
  slotCount: number;
  beats: ScriptBeat[];
  shots: StoryboardShot[] | undefined;
  scriptBeatSelection: string[] | undefined;
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
}): SplitShotBeatAssignment[] {
  const slots = Math.max(0, opts.slotCount);
  if (slots === 0) return [];

  const scopeResult = resolveStoryboardBeatScope(opts.beats, opts.scriptBeatSelection);
  if (!scopeResult.ok) return [];

  const orderedIds = scopeResult.scope.beats.map((b) => b.id);
  const anchorIdx = orderedIds.indexOf(opts.anchorBeatId);
  if (anchorIdx < 0) return [];

  const shotByBeat = new Map((opts.shots ?? []).map((s) => [s.scriptBeatId, s]));
  const imageByBeat = findImageNodesForScript(opts.scriptNodeId, opts.nodes, opts.edges);
  const beatById = new Map(scopeResult.scope.beats.map((b) => [b.id, b]));

  const out: SplitShotBeatAssignment[] = [];
  for (let i = anchorIdx + 1; i < orderedIds.length && out.length < slots; i++) {
    const beatId = orderedIds[i]!;
    const beat = beatById.get(beatId);
    if (!beat) continue;
    const shot = shotByBeat.get(beatId);
    const imageNode = opts.nodes.find((n) => n.id === imageByBeat.get(beatId));
    if (shotHasGeneratedImage(beatId, shot, imageNode)) continue;
    out.push({
      beatId,
      shotNumber: (beat.shotNumber || "").trim() || beat.id.slice(0, 6),
    });
  }
  return out;
}

/** 将已落盘的衍生图片节点写回分镜库 */
export function writebackSpawnedImagesToStoryboard(opts: {
  assignments: Array<{ imageNodeId: string; relPath: string }>;
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  updateNodeData: (id: string, patch: Partial<FlowNodeData>) => void;
}): number {
  let count = 0;
  for (const row of opts.assignments) {
    if (
      writebackStoryboardShotImagePath({
        nodes: opts.nodes,
        edges: opts.edges,
        imageNodeId: row.imageNodeId,
        imageRelPath: row.relPath,
        updateNodeData: opts.updateNodeData,
      })
    ) {
      count += 1;
    }
  }
  return count;
}
