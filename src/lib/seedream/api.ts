/**
 * Seedream API 客户端
 * 火山方舟: https://ark.cn-beijing.volces.com/api/v3
 */

import { invoke } from "@tauri-apps/api/core";
import type {
  SeedreamCreateTaskRequest,
  SeedreamCreateTaskResponse,
  SeedreamGetTaskResponse,
  SeedreamModelId,
  SeedreamResolution,
  SeedreamStyle,
} from "./types";

const DEFAULT_API_BASE = "https://ark.cn-beijing.volces.com/api/v3";
const DEFAULT_POLL_INTERVAL = 2000;
const DEFAULT_MAX_POLL = 120;

/**
 * 读取本地文件并返回 base64
 */
async function readFileAsBase64(path: string): Promise<string> {
  return invoke<string>("read_file_as_base64", { path });
}

export interface SeedreamClientConfig {
  apiKey: string;
  baseUrl?: string;
}

/**
 * 提交图片生成任务
 */
export async function submitImageTask(
  config: SeedreamClientConfig,
  request: SeedreamCreateTaskRequest
): Promise<string> {
  const baseUrl = config.baseUrl || DEFAULT_API_BASE;
  const url = `${baseUrl}/contents/generations/tasks`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Seedream API error: ${response.status} ${text}`);
  }

  const data: SeedreamCreateTaskResponse = await response.json();
  return data.id;
}

/**
 * 查询任务状态
 */
export async function getImageTaskStatus(
  config: SeedreamClientConfig,
  taskId: string
): Promise<SeedreamGetTaskResponse> {
  const baseUrl = config.baseUrl || DEFAULT_API_BASE;
  const url = `${baseUrl}/contents/generations/tasks/${taskId}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Seedream status error: ${response.status} ${text}`);
  }

  return response.json();
}

/**
 * 下载图片到工程目录
 */
export async function downloadImageToProject(
  projectPath: string,
  imageUrl: string
): Promise<string> {
  const result: { rel_path: string } = await invoke("download_remote_asset_to_project", {
    projectPath,
    url: imageUrl,
    kind: "image",
    sourceLabel: "seedream",
  });
  return result.rel_path;
}

/**
 * 轮询任务直到完成
 */
export async function pollImageTask(
  config: SeedreamClientConfig,
  taskId: string,
  options?: {
    pollIntervalMs?: number;
    maxPoll?: number;
    onProgress?: (progress: number, status: string) => void;
  }
): Promise<{ status: string; imageUrl?: string; error?: string }> {
  const pollInterval = options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL;
  const maxPoll = options?.maxPoll ?? DEFAULT_MAX_POLL;

  for (let i = 0; i < maxPoll; i++) {
    const result = await getImageTaskStatus(config, taskId);

    const status = result.status;
    const progress = result.progress;

    if (status === "succeeded") {
      return {
        status: "succeeded",
        imageUrl: result.result?.image_url,
      };
    }

    if (status === "failed") {
      return {
        status: "failed",
        error: result.error?.message || "图片生成失败",
      };
    }

    options?.onProgress?.(progress ?? (i / maxPoll), status);
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  return { status: "timeout", error: "轮询超时" };
}

/**
 * 完整的图片生成流程：构建请求（读取本地文件） -> 提交 -> 轮询 -> 下载
 */
export async function generateImage(options: {
  apiKey: string;
  baseUrl?: string;
  model: SeedreamModelId;
  prompt: string;
  negativePrompt?: string;
  referenceImagePaths?: string[];
  resolution?: SeedreamResolution;
  style?: SeedreamStyle;
  projectPath: string;
  onProgress?: (progress: number, status: string) => void;
}): Promise<{ relPath: string; taskId: string }> {
  // 将参考图路径转换为 base64
  const referenceImages: string[] = [];
  if (options.referenceImagePaths?.length) {
    for (const path of options.referenceImagePaths.slice(0, 4)) {
      // Seedream 最多 4 张参考图
      try {
        const base64 = await readFileAsBase64(path);
        referenceImages.push(base64);
      } catch (err) {
        console.warn(`[Seedream] 读取参考图失败: ${path}`, err);
      }
    }
  }

  const request: SeedreamCreateTaskRequest = {
    model: options.model,
    input: {
      prompt: options.prompt,
      ...(options.negativePrompt && { negative_prompt: options.negativePrompt }),
      ...(referenceImages.length > 0 && { images: referenceImages }),
    },
    parameters: {
      ...(options.resolution && { resolution: options.resolution }),
      ...(options.style && { style: options.style }),
    },
  };

  const taskId = await submitImageTask(
    { apiKey: options.apiKey, baseUrl: options.baseUrl },
    request
  );

  const result = await pollImageTask(
    { apiKey: options.apiKey, baseUrl: options.baseUrl },
    taskId,
    { onProgress: options.onProgress }
  );

  if (result.status !== "succeeded" || !result.imageUrl) {
    throw new Error(result.error || "图片生成失败");
  }

  const relPath = await downloadImageToProject(options.projectPath, result.imageUrl);
  return { relPath, taskId };
}
