/**
 * TTS API 客户端
 * 火山方舟: https://ark.cn-beijing.volces.com/api/v3
 */

import { invoke } from "@tauri-apps/api/core";
import type {
  TtsCreateTaskRequest,
  TtsCreateTaskResponse,
  TtsGetTaskResponse,
  TtsModelId,
  TtsVoice,
  TtsAudioFormat,
} from "./types";

const DEFAULT_API_BASE = "https://ark.cn-beijing.volces.com/api/v3";
const DEFAULT_POLL_INTERVAL = 2000;
const DEFAULT_MAX_POLL = 60;

export interface TtsClientConfig {
  apiKey: string;
  baseUrl?: string;
}

/**
 * 提交 TTS 任务
 */
export async function submitTtsTask(
  config: TtsClientConfig,
  request: TtsCreateTaskRequest
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
    throw new Error(`TTS API error: ${response.status} ${text}`);
  }

  const data: TtsCreateTaskResponse = await response.json();
  return data.id;
}

/**
 * 查询 TTS 任务状态
 */
export async function getTtsTaskStatus(
  config: TtsClientConfig,
  taskId: string
): Promise<TtsGetTaskResponse> {
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
    throw new Error(`TTS status error: ${response.status} ${text}`);
  }

  return response.json();
}

/**
 * 下载音频到工程目录
 */
export async function downloadAudioToProject(
  projectPath: string,
  audioUrl: string
): Promise<string> {
  const result: { rel_path: string } = await invoke("download_remote_asset_to_project", {
    projectPath,
    url: audioUrl,
    kind: "audio",
    sourceLabel: "tts",
  });
  return result.rel_path;
}

/**
 * 轮询 TTS 任务直到完成
 */
export async function pollTtsTask(
  config: TtsClientConfig,
  taskId: string,
  options?: {
    pollIntervalMs?: number;
    maxPoll?: number;
    onProgress?: (progress: number, status: string) => void;
  }
): Promise<{ status: string; audioUrl?: string; error?: string }> {
  const pollInterval = options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL;
  const maxPoll = options?.maxPoll ?? DEFAULT_MAX_POLL;

  for (let i = 0; i < maxPoll; i++) {
    const result = await getTtsTaskStatus(config, taskId);

    if (result.status === "succeeded") {
      return {
        status: "succeeded",
        audioUrl: result.result?.audio_url,
      };
    }

    if (result.status === "failed") {
      return {
        status: "failed",
        error: result.error?.message || "TTS 生成失败",
      };
    }

    options?.onProgress?.(result.status === "pending" ? 0 : (i / maxPoll), result.status);
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  return { status: "timeout", error: "轮询超时" };
}

/**
 * 完整的 TTS 生成流程：提交 -> 轮询 -> 下载
 */
export async function synthesizeSpeech(options: {
  apiKey: string;
  baseUrl?: string;
  model: TtsModelId;
  text: string;
  voice: TtsVoice;
  speed?: number;
  format?: TtsAudioFormat;
  projectPath: string;
  onProgress?: (progress: number, status: string) => void;
}): Promise<{ relPath: string; taskId: string }> {
  const request: TtsCreateTaskRequest = {
    model: options.model,
    input: {
      text: options.text,
      voice: options.voice,
    },
    parameters: {
      ...(options.speed !== undefined && { speed: options.speed }),
      ...(options.format && { format: options.format }),
    },
  };

  const taskId = await submitTtsTask(
    { apiKey: options.apiKey, baseUrl: options.baseUrl },
    request
  );

  const result = await pollTtsTask(
    { apiKey: options.apiKey, baseUrl: options.baseUrl },
    taskId,
    { onProgress: options.onProgress }
  );

  if (result.status !== "succeeded" || !result.audioUrl) {
    throw new Error(result.error || "TTS 生成失败");
  }

  const relPath = await downloadAudioToProject(options.projectPath, result.audioUrl);
  return { relPath, taskId };
}
