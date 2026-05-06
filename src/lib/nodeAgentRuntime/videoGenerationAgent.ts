import { startVideoGenerationViaBridge } from "@/lib/videoGeneration";
import type { NodeTaskAgentRuntime } from "@/lib/nodeAgentRuntime/types";
import { buildMergedGenerationPrompt } from "@/lib/ttvCameraUi";
import type { VideoNodePersisted } from "@/lib/videoNodeTypes";

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
    const { jobId } = await startVideoGenerationViaBridge({
      projectPath: ctx.projectPath,
      nodeId: ctx.nodeId,
      payload: {
        workflow: draft.workflow,
        modelId: draft.modelId,
        prompt: buildMergedGenerationPrompt(draft),
        referenceImagePaths: draft.referenceImagePaths,
        referenceVideoPaths: draft.referenceVideoPaths,
        referenceAudioPaths: draft.referenceAudioPaths,
        output: draft.output,
        cameraMovement: draft.cameraMovement,
      },
    });
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

