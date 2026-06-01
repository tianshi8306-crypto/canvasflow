import type { Edge, Node } from "@xyflow/react";
import type { HermesPlanStep } from "@/lib/hermes/hermesDirectorTypes";
import { findPrimaryScriptNode } from "@/lib/hermes/hermesCanvasContext";
import { resolveToolBeatIds } from "@/lib/hermes/hermesTools/toolBeatIds";
import {
  findImageNodesForScript,
  findVideoNodesForScript,
} from "@/lib/storyboard/storyboardMediaNodes";
import type { FlowNodeData } from "@/lib/types";
import { pulseHermesAgentHighlight } from "@/store/hermesCanvasHighlightStore";

const BEAT_AWARE_TOOLS = new Set<HermesPlanStep["toolId"]>([
  "canvas.focus",
  "storyboard.patch_shot",
  "image.generate_for_beats",
  "image.retry_failed",
  "video.generate_for_beats",
  "video.retry_failed",
  "chain.spawn_media_nodes",
  "film.shot_to_video_prompt",
  "film.batch_set_video_params",
]);

function nodeDisplayLabel(node: Node<FlowNodeData>): string {
  const type = node.type ?? "节点";
  const title =
    (node.data as { title?: string }).title?.trim() ||
    (node.data.prompt as string | undefined)?.trim()?.slice(0, 24);
  if (title) return `${type}「${title}」`;
  return type;
}

export function formatHermesSelectionAckLine(
  nodes: Node<FlowNodeData>[],
  selectedNodeIds: string[],
): string | null {
  if (selectedNodeIds.length === 0) return null;
  const picked = selectedNodeIds
    .map((id) => nodes.find((n) => n.id === id))
    .filter((n): n is Node<FlowNodeData> => Boolean(n));
  if (picked.length === 0) return null;
  if (picked.length === 1) {
    return `已注意到选中：${nodeDisplayLabel(picked[0]!)}`;
  }
  return `已注意到选中 ${picked.length} 个节点`;
}

export function resolveStepHighlightNodeIds(
  step: HermesPlanStep,
  opts: {
    sourceMessage: string;
    scriptNodeId?: string | null;
    nodes: Node<FlowNodeData>[];
    edges: Edge[];
  },
): string[] {
  if (!BEAT_AWARE_TOOLS.has(step.toolId)) return [];

  const scriptNodeId =
    opts.scriptNodeId?.trim() || findPrimaryScriptNode(opts.nodes)?.id || null;
  if (!scriptNodeId) return [];

  const beatIds = resolveToolBeatIds(
    scriptNodeId,
    step.args,
    opts.sourceMessage,
    opts.nodes,
  );
  const targetRaw = String(step.args?.target ?? "").trim().toLowerCase();
  const targetVideo = targetRaw === "video";
  const targetImage = targetRaw === "image";
  const targetScript =
    step.toolId === "canvas.focus" &&
    (targetRaw === "script" || targetRaw === "storyboard" || targetRaw === "table");

  if (targetScript && beatIds?.length) {
    return [scriptNodeId];
  }

  const nodeIds: string[] = [];
  if (beatIds?.length) {
    const imageByBeat = findImageNodesForScript(scriptNodeId, opts.nodes, opts.edges);
    const videoByBeat = findVideoNodesForScript(scriptNodeId, opts.nodes, opts.edges);
    for (const beatId of beatIds) {
      let mediaId: string | undefined;
      if (targetVideo) mediaId = videoByBeat.get(beatId);
      else if (targetImage) mediaId = imageByBeat.get(beatId);
      else mediaId = videoByBeat.get(beatId) ?? imageByBeat.get(beatId);
      if (mediaId) nodeIds.push(mediaId);
    }
    if (nodeIds.length === 0) {
      nodeIds.push(scriptNodeId);
    }
  } else if (step.toolId === "canvas.focus") {
    nodeIds.push(scriptNodeId);
  } else {
    nodeIds.push(scriptNodeId);
  }

  return [...new Set(nodeIds)];
}

export function pulseHermesHighlightForStep(
  step: HermesPlanStep,
  opts: {
    sourceMessage: string;
    scriptNodeId?: string | null;
    nodes: Node<FlowNodeData>[];
    edges: Edge[];
  },
): void {
  const nodeIds = resolveStepHighlightNodeIds(step, opts);
  if (nodeIds.length === 0) return;
  pulseHermesAgentHighlight(nodeIds, step.label);
}
