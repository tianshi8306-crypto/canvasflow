import type {
  CameraMovementDraft,
  VideoGenOutputSpec,
  VideoGenerationWorkflow,
  VideoJobStatus,
  VideoModelId,
} from "@/lib/videoNodeTypes";
import type { VideoModelCatalogEntry } from "@/lib/videoGeneration/catalog";
import { VIDEO_MODEL_CATALOG } from "@/lib/videoGeneration/catalog";

/**
 * 一次生成任务在前后端之间的快照（轮询用）
 */
export type VideoJobSnapshot = {
  id: string;
  status: VideoJobStatus;
  progress?: number;
  error?: string | null;
  modelId: VideoModelId;
  /** 任务快照来源：bridge(真实命令) / mock(本地模拟) */
  source?: "bridge" | "mock";
  /** 成功落盘后的工程相对路径 */
  resultRelPath?: string | null;
};

/**
 * 启动生成时传入的载荷（与 Rust `video_gen_start` 对齐）
 */
export type VideoGenerationStartPayload = {
  workflow: VideoGenerationWorkflow;
  modelId: VideoModelId;
  prompt: string;
  referenceImagePaths?: string[];
  referenceVideoPaths?: string[];
  referenceAudioPaths?: string[];
  output: VideoGenOutputSpec;
  cameraMovement?: CameraMovementDraft;
};

export type VideoGenerationStartRequest = {
  projectPath: string;
  /** 画布节点 id，便于后端写回或审计 */
  nodeId: string;
  payload: VideoGenerationStartPayload;
};

/** 轮询时附带工程上下文，内存任务表丢失后仍可恢复即梦/Seedance 查询 */
export type VideoJobPollHint = {
  projectPath: string;
  nodeId: string;
  modelId: string;
  workflow?: string;
};

/**
 * 视频生成 API 池：可替换为真实供应商适配器，默认注册 Mock。
 */
export type VideoGenerationClient = {
  listModels(): Promise<VideoModelCatalogEntry[]>;
  startJob(req: VideoGenerationStartRequest): Promise<{ jobId: string }>;
  getJob(jobId: string): Promise<VideoJobSnapshot>;
  cancelJob(jobId: string): Promise<void>;
};

type MockJob = {
  payload: VideoGenerationStartPayload;
  createdAt: number;
  polls: number;
};

function createMockVideoGenerationClient(): VideoGenerationClient {
  const jobs = new Map<string, MockJob>();

  return {
    async listModels() {
      return [...VIDEO_MODEL_CATALOG];
    },

    async startJob(req: VideoGenerationStartRequest) {
      const jobId = `mock_${crypto.randomUUID()}`;
      jobs.set(jobId, { payload: req.payload, createdAt: Date.now(), polls: 0 });
      return { jobId };
    },

    async getJob(jobId: string): Promise<VideoJobSnapshot> {
      const j = jobs.get(jobId);
      if (!j) {
        return {
          id: jobId,
          status: "failed",
          error: "任务不存在（可能已过期）",
          modelId: "doubao_seedance_2_0",
          source: "mock",
        };
      }
      j.polls += 1;
      const modelId = j.payload.modelId;
      if (j.polls < 4) {
        return {
          id: jobId,
          status: j.polls === 1 ? "queued" : "running",
          progress: Math.min(0.25 * j.polls, 0.95),
          modelId,
          source: "mock",
        };
      }
      /** Mock：成功但无真实文件，仅用于联调状态机；接入后端后写入 resultRelPath */
      return {
        id: jobId,
        status: "succeeded",
        progress: 1,
        modelId,
        source: "mock",
        resultRelPath: null,
      };
    },

    async cancelJob(jobId: string) {
      jobs.delete(jobId);
    },
  };
}

let activeClient: VideoGenerationClient = createMockVideoGenerationClient();

export function getVideoGenerationClient(): VideoGenerationClient {
  return activeClient;
}

/** 单元测试或接入真实供应商时替换 */
export function setVideoGenerationClient(client: VideoGenerationClient) {
  activeClient = client;
}

export function resetVideoGenerationClientToMock() {
  activeClient = createMockVideoGenerationClient();
}
