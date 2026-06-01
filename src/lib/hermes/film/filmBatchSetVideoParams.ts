import type { Edge, Node } from "@xyflow/react";
import {
  beatIdsForShotNumbers,
  findPrimaryScriptNode,
} from "@/lib/hermes/hermesCanvasContext";
import { resolveHermesShotNumbers } from "@/lib/hermes/hermesReferentResolution";
import { findVideoNodesForScript } from "@/lib/storyboard/storyboardMediaNodes";
import { normalizeScriptBeats } from "@/lib/scriptBeatHelpers";
import {
  SEEDANCE_OUTPUT_DURATION_MAX,
  SEEDANCE_OUTPUT_DURATION_MIN,
} from "@/lib/seedance/validation";
import {
  defaultVideoGenerationDraft,
  defaultVideoNodePersisted,
  type TextToVideoAspectId,
} from "@/lib/videoNodeTypes";
import type { FlowNodeData } from "@/lib/types";
import { useProjectStore } from "@/store/projectStore";

const ASPECT_IDS = new Set<TextToVideoAspectId>([
  "16:9",
  "9:16",
  "1:1",
  "4:3",
  "3:4",
  "21:9",
]);

export type BatchSetVideoParamsInput = {
  scriptNodeId?: string;
  beatIds?: number[];
  sourceMessage?: string;
  durationSec?: number;
  aspectRatio?: string;
  resolution?: "720P" | "1080P";
};

export type BatchSetVideoParamsResult = {
  updated: number;
  skipped: number;
  message: string;
};

function resolveBeatFilter(
  scriptNodeId: string,
  beatIds: number[] | undefined,
  sourceMessage: string | undefined,
): Set<string> | null {
  if (beatIds?.length) {
    const beats = normalizeScriptBeats(
      useProjectStore.getState().nodes.find((n) => n.id === scriptNodeId)?.data
        .scriptBeats,
    );
    return new Set(beatIdsForShotNumbers(beats, beatIds));
  }
  const nums = sourceMessage ? resolveHermesShotNumbers(sourceMessage) : [];
  if (nums.length === 0) return null;
  const beats = normalizeScriptBeats(
    useProjectStore.getState().nodes.find((n) => n.id === scriptNodeId)?.data
      .scriptBeats,
  );
  return new Set(beatIdsForShotNumbers(beats, nums));
}

export function runBatchSetVideoParams(
  input: BatchSetVideoParamsInput,
): BatchSetVideoParamsResult {
  const state = useProjectStore.getState();
  const scriptNodeId =
    input.scriptNodeId?.trim() ||
    findPrimaryScriptNode(state.nodes)?.id ||
    "";
  if (!scriptNodeId) {
    return { updated: 0, skipped: 0, message: "请先在画布上创建脚本节点" };
  }

  const durationSec =
    typeof input.durationSec === "number" && input.durationSec > 0
      ? Math.min(
          SEEDANCE_OUTPUT_DURATION_MAX,
          Math.max(SEEDANCE_OUTPUT_DURATION_MIN, Math.round(input.durationSec)),
        )
      : undefined;
  const aspectRaw = input.aspectRatio?.trim();
  const aspectRatio =
    aspectRaw && ASPECT_IDS.has(aspectRaw as TextToVideoAspectId)
      ? (aspectRaw as TextToVideoAspectId)
      : undefined;
  const resolution =
    input.resolution === "1080P" || input.resolution === "720P"
      ? input.resolution
      : undefined;

  if (!durationSec && !aspectRatio && !resolution) {
    return {
      updated: 0,
      skipped: 0,
      message: "请指定 durationSec、aspectRatio 或 resolution 至少一项",
    };
  }

  const beatFilter = resolveBeatFilter(
    scriptNodeId,
    input.beatIds,
    input.sourceMessage,
  );
  const videoByBeat = findVideoNodesForScript(
    scriptNodeId,
    state.nodes as Node<FlowNodeData>[],
    state.edges as Edge[],
  );

  let updated = 0;
  let skipped = 0;

  for (const [beatId, videoNodeId] of videoByBeat) {
    if (beatFilter && !beatFilter.has(beatId)) {
      skipped += 1;
      continue;
    }
    const vnode = state.nodes.find((n) => n.id === videoNodeId);
    if (!vnode) {
      skipped += 1;
      continue;
    }
    const curVideo = vnode.data.video ?? defaultVideoNodePersisted();
    const nextOutput = {
      ...defaultVideoGenerationDraft().output,
      ...curVideo.draft?.output,
      ...(durationSec != null ? { durationSec } : {}),
      ...(aspectRatio ? { aspectRatio } : {}),
      ...(resolution ? { resolution } : {}),
    };
    state.updateNodeData(videoNodeId, {
      video: {
        ...curVideo,
        draft: {
          ...defaultVideoGenerationDraft(),
          ...curVideo.draft,
          output: nextOutput,
        },
      },
    });
    updated += 1;
  }

  const parts: string[] = [];
  if (durationSec != null) parts.push(`${durationSec}s`);
  if (aspectRatio) parts.push(aspectRatio);
  if (resolution) parts.push(resolution);

  const message =
    updated > 0
      ? `已为 ${updated} 个 videoNode 写入参数（${parts.join(" · ")}，跳过 ${skipped}）`
      : `未更新任何视频节点（请先建链；跳过 ${skipped}）`;

  state.setStatusText(`Hermes：${message}`);
  return { updated, skipped, message };
}
