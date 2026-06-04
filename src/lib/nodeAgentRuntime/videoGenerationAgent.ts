import { startVideoGenerationViaBridge } from "@/lib/videoGeneration";
import type { NodeTaskAgentRuntime } from "@/lib/nodeAgentRuntime/types";
import { applyNoSubtitlePrompt } from "@/lib/videoGeneration/noSubtitlePrompt";
import { buildMergedGenerationPrompt } from "@/lib/ttvCameraUi";
import type { VideoNodePersisted } from "@/lib/videoNodeTypes";
import { buildSeedancePromptSimple } from "@/lib/seedance/promptBuilder";
import {
  buildNamedAssetsForVideoGeneration,
  buildPanelOrderedRefs,
} from "@/lib/seedance/videoPromptAtTokens";
import {
  buildVideoPanelTextRefs,
  expandPromptTextAtReferences,
} from "@/lib/promptUpstreamTextRefs";
import { resolveOrderedVideoIncomingRefItems } from "@/hooks/useVideoIncomingReferenceItems";
import { useProjectStore } from "@/store/projectStore";
import { refreshDreaminaAuthOnGenerationFailure } from "@/lib/dreaminaAuthOnFailure";
import { parseVideoGenError } from "@/lib/video/formatVideoGenError";
import { isDreaminaModel } from "@/lib/dreamina/model";
import { readFileAsDataUrl } from "@/lib/mediaUtils";
import { joinProjectRelativePath } from "@/lib/paths";
import { bypassFaceReviewBatch } from "@/lib/seedance/faceBypass";
import { injectVirtualCharacterPrefix } from "@/lib/seedance/faceBypass/bypassPrompt";

type VideoGenerationAgentInput = {
  videoBlock: VideoNodePersisted;
};

type VideoGenerationSensed = {
  videoBlock: VideoNodePersisted;
};

type VideoGenerationExecuted = {
  jobId: string;
  videoBlock: VideoNodePersisted;
};

type VideoGenerationCommitted = {
  jobId: string;
  videoBlock: VideoNodePersisted;
};

/**
 * 视频节点单任务 Agent：提交生成任务并写入 activeJob。
 */
export const videoGenerationAgentRuntime: NodeTaskAgentRuntime<
  VideoGenerationAgentInput,
  VideoGenerationSensed,
  VideoGenerationExecuted,
  VideoGenerationCommitted
> = {
  agentName: "视频 Agent",
  sense: ({ videoBlock }) => ({ videoBlock }),
  execute: async ({ videoBlock }, ctx) => {
    const draft = videoBlock.draft;
    const useDreaminaCli = isDreaminaModel(draft.modelId);

    // 构建 prompt，支持 @图N / @视频N / @音频N / @文件名 引用语法
    const merged = buildMergedGenerationPrompt(draft);
    const basePrompt = applyNoSubtitlePrompt(merged, draft.output.noSubtitles ?? false);
    const { nodes, edges } = useProjectStore.getState();
    const incoming = resolveOrderedVideoIncomingRefItems(ctx.nodeId, nodes, edges);
    const textRefs = buildVideoPanelTextRefs(incoming);
    const promptWithText = expandPromptTextAtReferences(basePrompt, textRefs);
    const panelOrder = buildPanelOrderedRefs(incoming);
    const namedAssets = buildNamedAssetsForVideoGeneration({
      videoNodeId: ctx.nodeId,
      draft,
      nodes,
      edges,
    });
    const { expandedPrompt, imagePaths: atImagePaths, videoPaths: atVideoPaths, audioPaths: atAudioPaths } =
      buildSeedancePromptSimple(
        promptWithText,
        draft.referenceImagePaths,
        draft.referenceVideoPaths,
        draft.referenceAudioPaths,
        namedAssets,
        panelOrder,
      );

    // 火山方舟需 Base64；即梦 CLI 使用工程相对路径
    const toAbs = (relPath: string) =>
      joinProjectRelativePath(ctx.projectPath, relPath);

    let imageDataUrls: string[] = [];
    let videoDataUrls: string[] = [];
    let audioDataUrls: string[] = [];

    if (
      !useDreaminaCli &&
      (atImagePaths.length > 0 || atVideoPaths.length > 0 || atAudioPaths.length > 0)
    ) {
      try {
        const results = await Promise.all([
          atImagePaths.length > 0
            ? Promise.all(atImagePaths.map((p) => readFileAsDataUrl(toAbs(p))))
            : Promise.resolve([]),
          atVideoPaths.length > 0
            ? Promise.all(atVideoPaths.map((p) => readFileAsDataUrl(toAbs(p))))
            : Promise.resolve([]),
          atAudioPaths.length > 0
            ? Promise.all(atAudioPaths.map((p) => readFileAsDataUrl(toAbs(p))))
            : Promise.resolve([]),
        ]);
        [imageDataUrls, videoDataUrls, audioDataUrls] = results;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        ctx.updateNodeData(ctx.nodeId, {
          video: {
            ...videoBlock,
            activeJob: {
              id: "",
              status: "failed",
              modelId: draft.modelId,
              error: `读取媒体文件失败：${msg}`,
              startedAt: new Date().toISOString(),
            },
          },
        });
        ctx.setStatusText(`媒体文件读取失败：${msg}`);
        throw new Error(`媒体文件读取失败：${msg}`);
      }
    }

    // ★ 人脸审核通关：仅 Seedance 2.0 火山方舟模式 + 开关开启时生效
    const isSeedance2 =
      draft.modelId === "doubao_seedance_2_0";
    const bypassEnabled = draft.faceBypassEnabled !== false; // 默认开启
    if (isSeedance2 && bypassEnabled && !useDreaminaCli && imageDataUrls.length > 0) {
      try {
        const results = await bypassFaceReviewBatch(imageDataUrls);
        imageDataUrls = results.map((r) => r.dataUrl); // 替换为处理后图片
      } catch {
        // 任何步骤失败：静默回退，使用原 imageDataUrls
      }
    }

    // 调用 API（出错时写入节点错误状态，让面板直接显示）
    let jobId: string;
    try {
      // ★ 提示词前缀注入：声明虚拟角色（与图片处理的开关保持一致）
      const finalPrompt =
        isSeedance2 && bypassEnabled
          ? injectVirtualCharacterPrefix(expandedPrompt)
          : expandedPrompt;

      const result = await startVideoGenerationViaBridge({
        projectPath: ctx.projectPath,
        nodeId: ctx.nodeId,
        payload: {
          workflow: draft.workflow,
          modelId: draft.modelId,
          prompt: finalPrompt,
          referenceImagePaths:
            (useDreaminaCli ? atImagePaths : imageDataUrls).length > 0
              ? useDreaminaCli
                ? atImagePaths
                : imageDataUrls
              : undefined,
          referenceVideoPaths:
            (useDreaminaCli ? atVideoPaths : videoDataUrls).length > 0
              ? useDreaminaCli
                ? atVideoPaths
                : videoDataUrls
              : undefined,
          referenceAudioPaths:
            (useDreaminaCli ? atAudioPaths : audioDataUrls).length > 0
              ? useDreaminaCli
                ? atAudioPaths
                : audioDataUrls
              : undefined,
          output: draft.output,
          cameraMovement: draft.cameraMovement,
        },
      });
      jobId = result.jobId;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const human = parseVideoGenError(msg).summary;
      refreshDreaminaAuthOnGenerationFailure(draft.modelId);
      ctx.updateNodeData(ctx.nodeId, {
        video: {
          ...videoBlock,
          activeJob: {
            id: "",
            status: "failed",
            modelId: draft.modelId,
            error: `视频生成失败：${msg}`,
            startedAt: new Date().toISOString(),
          },
        },
      });
      ctx.setStatusText(human);
      throw new Error(`视频生成失败：${msg}`);
    }
    return { jobId, videoBlock };
  },
  validate: ({ jobId, videoBlock }) => {
    const id = jobId.trim();
    if (!id) throw new Error("视频任务未返回 jobId");
    return { jobId: id, videoBlock };
  },
  commit: ({ jobId, videoBlock }, ctx) => {
    const modelId = videoBlock.draft.modelId;
    ctx.updateNodeData(ctx.nodeId, {
      video: {
        ...videoBlock,
        activeJob: {
          id: jobId,
          status: "queued",
          modelId,
          startedAt: new Date().toISOString(),
        },
      },
    });
    ctx.setStatusText("已提交视频生成任务");
  },
};

