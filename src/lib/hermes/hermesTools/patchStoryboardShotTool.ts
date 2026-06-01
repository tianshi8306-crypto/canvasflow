import { isTauri } from "@tauri-apps/api/core";
import type { HermesPlanStep } from "@/lib/hermes/hermesDirectorTypes";
import type { HermesToolRunResult } from "@/lib/hermes/hermesDirectorTypes";
import { handleScriptNodeCompleted } from "@/lib/hermes/autoChain";
import {
  enrichShotsWithCharacterMotionPrompts,
  wantsCharacterMotionVideoPrompt,
} from "@/lib/hermes/film/filmCharacterMotionPrompt";
import { buildSeedanceVideoPromptFromVisual } from "@/lib/hermes/film/filmShotToVideoPrompt";
import { resolveToolBeatIds } from "@/lib/hermes/hermesTools/toolBeatIds";
import {
  buildVideoDraftPromptFromScriptBeatBinding,
} from "@/lib/incomingScriptBinding";
import { normalizeScriptBeats } from "@/lib/scriptBeatHelpers";
import { batchGenerateImagesForStoryboard } from "@/lib/storyboard/batchGenerateImages";
import { batchGenerateVideosForStoryboard } from "@/lib/storyboard/batchGenerateVideos";
import { getAgentMaxConcurrentMedia } from "@/lib/hermes/agent/hermesAgentSettings";
import { patchStoryboardShot } from "@/lib/storyboard/patchStoryboardShot";
import { createBeatReferenceResolver } from "@/lib/projectBible/resolveBeatRefsForBatch";
import { findVideoNodesForScript } from "@/lib/storyboard/storyboardMediaNodes";
import { useProjectBibleStore } from "@/store/projectBibleStore";
import type { FlowNodeData, StoryboardShot } from "@/lib/types";
import {
  defaultVideoGenerationDraft,
  defaultVideoNodePersisted,
} from "@/lib/videoNodeTypes";
import { DESKTOP_SHELL_HINT } from "@/lib/tauriEnv";
import { useProjectStore } from "@/store/projectStore";
import {
  extractNlVisualPrompt,
  parseHermesNlPatchIntent,
} from "@/lib/hermes/hermesNlPatch";
import {
  mergeVisualWithStyleReference,
} from "@/lib/hermes/agent/hermesStyleReferent";
import { recordStyleAnchorFromScriptBeat } from "@/lib/hermes/agent/hermesCanvasEventCache";

export type PatchStoryboardShotArgs = {
  beatIds?: number[];
  visualPrompt?: string;
  videoMotionPrompt?: string;
  compositionNote?: string;
  negativePrompt?: string;
  regenerateImage?: boolean;
  regenerateVideo?: boolean;
  style?: string;
  /** iter-102：从指定镜号复制画面风格 */
  styleReferenceShot?: number;
  styleReferenceSnippet?: string;
};

/** @deprecated 使用 {@link extractNlVisualPrompt} from hermesNlPatch */
export { extractNlVisualPrompt as extractVisualPatchFromMessage } from "@/lib/hermes/hermesNlPatch";

function patchScriptBeatFields(
  scriptNodeId: string,
  beatId: string,
  patch: { videoMotionPrompt?: string },
  updateNodeData: (id: string, dataPatch: Partial<FlowNodeData>) => void,
): void {
  const scriptNode = useProjectStore.getState().nodes.find((n) => n.id === scriptNodeId);
  if (!scriptNode) return;
  const beats = normalizeScriptBeats(scriptNode.data.scriptBeats).map((b) =>
    b.id === beatId
      ? {
          ...b,
          ...(patch.videoMotionPrompt !== undefined
            ? { videoMotionPrompt: patch.videoMotionPrompt }
            : {}),
        }
      : b,
  );
  updateNodeData(scriptNodeId, { scriptBeats: beats });
}

function syncVideoDraftForBeat(
  scriptNodeId: string,
  beatId: string,
  style: string | undefined,
): boolean {
  const state = useProjectStore.getState();
  const videoByBeat = findVideoNodesForScript(scriptNodeId, state.nodes, state.edges);
  const videoNodeId = videoByBeat.get(beatId);
  if (!videoNodeId) return false;

  const bound = buildVideoDraftPromptFromScriptBeatBinding(
    state.nodes,
    state.edges,
    videoNodeId,
  );
  const shot = state.nodes
    .find((n) => n.id === scriptNodeId)
    ?.data.storyboardShots?.find((s) => s.scriptBeatId === beatId);
  const prompt =
    bound?.trim() ||
    buildSeedanceVideoPromptFromVisual(shot?.visualPrompt ?? "", { style }) ||
    "";
  if (!prompt) return false;

  const vnode = state.nodes.find((n) => n.id === videoNodeId);
  const curVideo = vnode?.data.video ?? defaultVideoNodePersisted();
  state.updateNodeData(videoNodeId, {
    video: {
      ...curVideo,
      draft: {
        ...defaultVideoGenerationDraft(),
        ...curVideo.draft,
        prompt,
      },
    },
  });
  return true;
}

function buildShotPatchFromArgs(
  args: PatchStoryboardShotArgs | undefined,
  sourceMessage: string,
): Partial<StoryboardShot> {
  const nl = parseHermesNlPatchIntent(sourceMessage);
  const visual =
    args?.visualPrompt?.trim() ||
    nl?.visualPrompt ||
    extractNlVisualPrompt(sourceMessage);
  const patch: Partial<StoryboardShot> = {};
  if (visual) {
    patch.visualPrompt = visual;
    patch.status = "generated";
    patch.error = undefined;
  }
  const composition =
    args?.compositionNote?.trim() || nl?.compositionNote?.trim();
  if (composition) patch.compositionNote = composition;
  const negative = args?.negativePrompt?.trim() || nl?.negativePrompt?.trim();
  if (negative) patch.negativePrompt = negative;
  return patch;
}

function resolveStyleReferenceFromArgs(
  scriptNode: { data: FlowNodeData },
  args: PatchStoryboardShotArgs | undefined,
): string | undefined {
  const snippet = args?.styleReferenceSnippet?.trim();
  if (snippet) return snippet;
  const refShot = args?.styleReferenceShot;
  if (!refShot || refShot < 1) return undefined;
  const beats = normalizeScriptBeats(scriptNode.data.scriptBeats);
  const beat = beats[refShot - 1];
  if (!beat) return undefined;
  const shot = (scriptNode.data.storyboardShots ?? []).find(
    (s) => s.scriptBeatId === beat.id,
  );
  return shot?.visualPrompt?.trim();
}

export async function runPatchStoryboardShotTool(
  step: HermesPlanStep,
  opts: { sourceMessage: string; scriptNodeId?: string | null },
): Promise<HermesToolRunResult> {
  if (!isTauri()) {
    return { ok: false, message: DESKTOP_SHELL_HINT };
  }

  const state = useProjectStore.getState();
  const projectPath = state.projectPath?.trim();
  if (!projectPath) {
    return { ok: false, message: "请先打开工程" };
  }

  const scriptNodeId = opts.scriptNodeId?.trim();
  if (!scriptNodeId) {
    return { ok: false, message: "请先在画布上创建脚本节点" };
  }

  const scriptNode = state.nodes.find((n) => n.id === scriptNodeId && n.type === "scriptNode");
  if (!scriptNode) {
    return { ok: false, message: "未找到脚本节点" };
  }

  const args = step.args as PatchStoryboardShotArgs | undefined;
  const beatIds = resolveToolBeatIds(scriptNodeId, step.args, opts.sourceMessage);
  if (!beatIds?.length) {
    return {
      ok: false,
      message: "请指定镜号（如「第 2 镜」）",
      scriptNodeId,
    };
  }

  const shotPatch = buildShotPatchFromArgs(args, opts.sourceMessage);
  const styleRefVisual = resolveStyleReferenceFromArgs(scriptNode, args);
  const nlIntent = parseHermesNlPatchIntent(opts.sourceMessage);
  const motionPatch =
    args?.videoMotionPrompt?.trim() || nlIntent?.videoMotionPrompt?.trim();
  const regenerateImage = Boolean(args?.regenerateImage);
  const regenerateVideo = Boolean(args?.regenerateVideo);

  const motionOnlyViaDialogue =
    !motionPatch &&
    !shotPatch.visualPrompt &&
    wantsCharacterMotionVideoPrompt(opts.sourceMessage) &&
    /动作|运镜|走动|转身|视频.*词|动态|提示词/.test(opts.sourceMessage);

  if (motionOnlyViaDialogue) {
    const shots = (scriptNode.data.storyboardShots ?? []).filter((s) =>
      beatIds.includes(s.scriptBeatId),
    );
    const beats = normalizeScriptBeats(scriptNode.data.scriptBeats);
    const style = args?.style ?? (/古风/.test(opts.sourceMessage) ? "古风" : undefined);
    const enriched = await enrichShotsWithCharacterMotionPrompts({
      scriptNodeId,
      shots,
      beats,
      sourceMessage: opts.sourceMessage,
      style,
    });
    return {
      ok: enriched.updated > 0,
      message:
        enriched.updated > 0
          ? `已按人物动作模板更新 ${enriched.updated} 镜视频提示词（${enriched.usedLlm ? "LLM" : "规则"}）`
          : "未能补全视频动作提示词",
      scriptNodeId,
    };
  }

  if (
    !shotPatch.visualPrompt &&
    !styleRefVisual &&
    motionPatch === undefined &&
    args?.compositionNote === undefined &&
    args?.negativePrompt === undefined &&
    !regenerateImage &&
    !regenerateVideo
  ) {
    return {
      ok: false,
      message: "请提供要修改的画面/运镜描述，或勾选重新出图/出视频",
      scriptNodeId,
    };
  }

  for (const beatId of beatIds) {
    const perShotPatch = { ...shotPatch };
    if (styleRefVisual && !perShotPatch.visualPrompt) {
      const shot = (scriptNode.data.storyboardShots ?? []).find(
        (s) => s.scriptBeatId === beatId,
      );
      perShotPatch.visualPrompt = mergeVisualWithStyleReference(
        shot?.visualPrompt ?? "",
        styleRefVisual,
      );
      perShotPatch.status = "generated";
      perShotPatch.error = undefined;
    }
    if (Object.keys(perShotPatch).length > 0) {
      patchStoryboardShot(scriptNodeId, beatId, perShotPatch, state.updateNodeData);
    }
    if (motionPatch !== undefined) {
      patchScriptBeatFields(
        scriptNodeId,
        beatId,
        { videoMotionPrompt: motionPatch },
        state.updateNodeData,
      );
    }
    syncVideoDraftForBeat(scriptNodeId, beatId, args?.style);
  }

  const parts: string[] = [];
  if (shotPatch.visualPrompt || styleRefVisual) {
    parts.push(`已更新 ${beatIds.length} 镜画面描述`);
  }
  if (motionPatch !== undefined) {
    parts.push(`已更新运镜提示词`);
  }

  const needChain = regenerateImage || regenerateVideo;
  if (needChain) {
    const chain = handleScriptNodeCompleted(scriptNodeId, { beatIds });
    if (chain.total > 0 && chain.succeeded === 0) {
      return {
        ok: false,
        message: "建链失败，无法提交生成任务",
        scriptNodeId,
      };
    }
  }

  const fresh = useProjectStore.getState();
  const freshScript = fresh.nodes.find((n) => n.id === scriptNodeId)!;

  if (regenerateImage) {
    const bible = useProjectBibleStore.getState().bible;
    const resolveBeatReferencePaths = createBeatReferenceResolver(
      freshScript.data.scriptBeats,
      bible,
    );
    const refPaths = Array.isArray(step.args?.referenceRelPaths)
      ? (step.args.referenceRelPaths as string[])
      : [];

    const batch = await batchGenerateImagesForStoryboard({
      scriptNodeId,
      nodes: fresh.nodes,
      edges: fresh.edges,
      projectPath,
      updateNodeData: fresh.updateNodeData,
      setStatusText: fresh.setStatusText,
      beatIds,
      skipIfHasImage: false,
      referenceImagePathsPrefix: refPaths,
      resolveBeatReferencePaths,
      maxConcurrent: getAgentMaxConcurrentMedia(),
    });
    parts.push(
      `出图：提交 ${batch.started}，跳过 ${batch.skipped}，失败 ${batch.failed}`,
    );
    if (batch.started === 0 && batch.failed > 0) {
      return { ok: false, message: parts.join("；"), scriptNodeId };
    }
  }

  if (regenerateVideo) {
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
      maxConcurrent: getAgentMaxConcurrentMedia(),
    });
    parts.push(
      `出视频：提交 ${batch.started}，跳过 ${batch.skipped}，失败 ${batch.failed}`,
    );
    if (batch.started === 0 && !regenerateImage) {
      return {
        ok: false,
        message: parts.join("；") || "没有可提交的视频任务",
        scriptNodeId,
      };
    }
  }

  if (parts.length === 0) {
    return { ok: false, message: "未应用任何修改", scriptNodeId };
  }

  fresh.setStatusText(`Hermes：${parts.join("；")}`);
  if ((shotPatch.visualPrompt || styleRefVisual) && beatIds[0]) {
    void recordStyleAnchorFromScriptBeat(projectPath, scriptNodeId, beatIds[0]!);
  }
  return {
    ok: true,
    message: parts.join("；"),
    scriptNodeId,
  };
}
