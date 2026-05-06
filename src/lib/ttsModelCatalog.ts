/** OpenAI 兼容 TTS 默认音色（/v1/audio/speech） */
export const TTS_VOICE_OPTIONS: { id: string; label: string }[] = [
  { id: "alloy", label: "alloy" },
  { id: "echo", label: "echo" },
  { id: "fable", label: "fable" },
  { id: "onyx", label: "onyx" },
  { id: "nova", label: "nova" },
  { id: "shimmer", label: "shimmer" },
];

/** 使用当前启用的 LLM Provider 的 API Key 与 Base URL（需含 /v1） */
export const TTS_DEFAULT_PROVIDER_MODEL_OPTIONS: { id: string; label: string; model: string }[] = [
  { id: "__provider_tts1__", label: "默认 Provider · tts-1", model: "tts-1" },
  { id: "__provider_tts1hd__", label: "默认 Provider · tts-1-hd", model: "tts-1-hd" },
];
