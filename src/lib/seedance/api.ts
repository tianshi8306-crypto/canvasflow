/**
 * Seedance API 客户端
 * 火山方舟: https://ark.cn-beijing.volces.com/api/v3
 */

import { invoke } from "@tauri-apps/api/core";
import type {
  SeedanceCreateTaskRequest,
  SeedanceCreateTaskResponse,
  SeedanceModelId,
  SeedanceContentItem,
  SeedanceParameters,
} from "./types";

const DEFAULT_API_BASE = "https://ark.cn-beijing.volces.com/api/v3";
const DEFAULT_POLL_INTERVAL = 3000;
const DEFAULT_MAX_POLL = 240;

/**
 * 读取本地文件并返回 base64
 */
async function readFileAsBase64(path: string): Promise<string> {
  return invoke<string>("read_file_as_base64", { path });
}

/**
 * 构建 Seedance 任务请求（异步，读取本地文件）
 */
async function buildCreateTaskRequest(config: {
  model: SeedanceModelId;
  prompt: string;
  referenceImagePaths?: string[];
  referenceVideoPaths?: string[];
  referenceAudioPaths?: string[];
  duration?: number;
  resolution?: string;
  ratio?: string;
  generateAudio?: boolean;
}): Promise<SeedanceCreateTaskRequest> {
  const content: SeedanceContentItem[] = [];

  // 添加文本 prompt
  if (config.prompt) {
    content.push({ type: "text", text: config.prompt });
  }

  // 添加参考图片（≤9张）
  // 第一张作为 first_frame，其余作为 reference_image
  if (config.referenceImagePaths?.length) {
    for (let idx = 0; idx < Math.min(config.referenceImagePaths.length, 9); idx++) {
      const path = config.referenceImagePaths[idx];
      const data = await readFileAsBase64(path);
      content.push({
        type: "image_url",
        role: idx === 0 ? "first_frame" : "reference_image",
        data,
      });
    }
  }

  // 添加参考视频（≤3个）
  if (config.referenceVideoPaths?.length) {
    for (let idx = 0; idx < Math.min(config.referenceVideoPaths.length, 3); idx++) {
      const path = config.referenceVideoPaths[idx];
      const data = await readFileAsBase64(path);
      content.push({
        type: "video_url",
        role: "reference_video",
        data,
      });
    }
  }

  // 添加参考音频（≤3个）
  if (config.referenceAudioPaths?.length) {
    for (let idx = 0; idx < Math.min(config.referenceAudioPaths.length, 3); idx++) {
      const path = config.referenceAudioPaths[idx];
      const data = await readFileAsBase64(path);
      content.push({
        type: "audio_url",
        data,
      });
    }
  }

  const parameters: SeedanceParameters = {
    duration: config.duration ?? 5,
    resolution: (config.resolution as SeedanceParameters["resolution"]) ?? "720p",
    ratio: (config.ratio as SeedanceParameters["ratio"]) ?? "16:9",
    generate_audio: config.generateAudio ?? true,
  };

  return {
    model: config.model,
    content,
    parameters,
  };
}

/**
 * 提交视频生成任务
 */
export async function submitVideoTask(
  apiKey: string,
  baseUrl: string | undefined,
  request: SeedanceCreateTaskRequest
): Promise<string> {
  const url = `${baseUrl || DEFAULT_API_BASE}/contents/generations/tasks`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Seedance API error: ${response.status} ${text}`);
  }

  const data: SeedanceCreateTaskResponse = await response.json();
  return data.id;
}

/**
 * 查询任务状态
 */
export async function getVideoTaskStatus(
  apiKey: string,
  baseUrl: string | undefined,
  taskId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const url = `${baseUrl || DEFAULT_API_BASE}/contents/generations/tasks/${taskId}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Seedance status error: ${response.status} ${text}`);
  }

  return response.json();
}

/**
 * 下载视频到工程目录
 */
export async function downloadVideoToProject(
  projectPath: string,
  videoUrl: string
): Promise<string> {
  const result: { rel_path: string } = await invoke("download_remote_asset_to_project", {
    projectPath,
    url: videoUrl,
    kind: "video",
    sourceLabel: "seedance",
  });
  return result.rel_path;
}

/**
 * 轮询任务直到完成
 */
export async function pollVideoTask(
  apiKey: string,
  baseUrl: string | undefined,
  taskId: string,
  options?: {
    pollIntervalMs?: number;
    maxPoll?: number;
    onProgress?: (progress: number, status: string) => void;
  }
): Promise<{ status: string; videoUrl?: string; error?: string }> {
  const pollInterval = options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL;
  const maxPoll = options?.maxPoll ?? DEFAULT_MAX_POLL;

  for (let i = 0; i < maxPoll; i++) {
    const result = await getVideoTaskStatus(apiKey, baseUrl, taskId);

    const status = result.data?.status || result.status;
    const progress = result.data?.progress ?? result.progress;

    if (status === "succeeded") {
      return {
        status: "succeeded",
        videoUrl: result.data?.result?.video_url || result.result?.video_url,
      };
    }

    if (status === "failed") {
      return {
        status: "failed",
        error: result.data?.error?.message || result.error?.message || "视频生成失败",
      };
    }

    options?.onProgress?.(progress ?? (i / maxPoll), status);
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  return {
    status: "timeout",
    error: "轮询超时",
  };
}

/**
 * 完整的视频生成流程：构建请求 -> 提交 -> 轮询 -> 下载
 */
export async function generateVideo(options: {
  apiKey: string;
  baseUrl?: string;
  model: SeedanceModelId;
  prompt: string;
  referenceImagePaths?: string[];
  referenceVideoPaths?: string[];
  referenceAudioPaths?: string[];
  duration?: number;
  resolution?: string;
  ratio?: string;
  generateAudio?: boolean;
  projectPath: string;
  onProgress?: (progress: number, status: string) => void;
}): Promise<{ relPath: string; taskId: string }> {
  // 1. 构建请求（异步读取本地文件为 base64）
  const request = await buildCreateTaskRequest(options);

  // 2. 提交任务
  const taskId = await submitVideoTask(options.apiKey, options.baseUrl, request);

  // 3. 轮询状态
  const result = await pollVideoTask(
    options.apiKey,
    options.baseUrl,
    taskId,
    { onProgress: options.onProgress }
  );

  if (result.status !== "succeeded" || !result.videoUrl) {
    throw new Error(result.error || "视频生成失败");
  }

  // 4. 下载视频到工程目录
  const relPath = await downloadVideoToProject(options.projectPath, result.videoUrl);

  return { relPath, taskId };
}
