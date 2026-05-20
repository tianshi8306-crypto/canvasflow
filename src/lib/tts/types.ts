/**
 * TTS 语音合成 API 类型定义
 */

export type TtsModelId = "tts-1" | "tts-1-hd" | "tts-2";

export type TtsVoice =
  | "alloy"      // 中性质
  | "echo"       // 温和
  | "fable"      // 故事感
  | "onyx"       // 成熟男声
  | "nova"       // 活力女声
  | "shimmer";   // 柔和女声

export type TtsAudioFormat = "mp3" | "wav" | "opus" | "aac";

export interface TtsCreateTaskRequest {
  model: TtsModelId;
  input: {
    text: string;
    voice: TtsVoice;
  };
  parameters?: {
    speed?: number; // 0.5 - 2.0
    format?: TtsAudioFormat;
  };
}

export interface TtsCreateTaskResponse {
  id: string;
}

export type TtsTaskStatus = "pending" | "processing" | "succeeded" | "failed";

export interface TtsTaskResult {
  audio_url?: string;
  duration?: number;
}

export interface TtsGetTaskResponse {
  id: string;
  status: TtsTaskStatus;
  error?: {
    code?: string;
    message?: string;
  };
  result?: TtsTaskResult;
}
