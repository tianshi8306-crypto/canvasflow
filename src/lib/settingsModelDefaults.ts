import { getProviderMeta, type ProviderId } from "@/lib/providers";
import { providerSupportsCapability } from "@/lib/providerCapabilities";
import {
  defaultDreaminaImageModelPresets,
  defaultDreaminaVideoModelPresets,
  mergeMissingDreaminaImagePresets,
  mergeMissingDreaminaVideoPresets,
} from "@/lib/dreamina/cliModels";
import { DOUBAO_SEEDANCE_API_MODEL, isDoubaoSeedancePreset } from "@/lib/videoGeneration/seedanceApiModel";
import type { AppSettings, ImageModelConfig, ProviderConfig } from "@/lib/settingsPanelTypes";

/** 设置页 / 空列表时注入的默认图片模型（Seedream API + 即梦 CLI 5.0/4.6） */
export function defaultImageModelPresets(): ImageModelConfig[] {
  return [
    {
      id: "preset-image-seedream-50-lite",
      vendorName: "Doubao",
      modelName: "Seedream",
      modelVariant: "5.0-lite",
      label: "Seedream 5.0 Lite",
      model: "Doubao-Seedream-5.0-lite",
      apiBaseUrl: "",
      enabled: true,
      priority: 0,
      supportsMultiRefFusion: true,
      maxReferenceImages: 4,
      supportsImageEdit: true,
    },
    ...defaultDreaminaImageModelPresets(1),
  ];
}

/** 默认视频模型（Doubao API + 即梦 CLI 全量） */
export function defaultVideoModelPresets(): ImageModelConfig[] {
  return [
    {
      id: "preset-video-doubao-seedance",
      vendorName: "",
      modelName: "",
      modelVariant: "",
      label: "Doubao Seedance 2.0",
      model: DOUBAO_SEEDANCE_API_MODEL,
      apiBaseUrl: "",
      enabled: true,
      priority: 0,
    },
    ...defaultDreaminaVideoModelPresets(10),
  ];
}

/** 默认语音模型（1） */
export function defaultAudioModelPresets(): ImageModelConfig[] {
  return [
    {
      id: "preset-audio-openai-tts",
      vendorName: "",
      modelName: "",
      modelVariant: "",
      label: "OpenAI TTS",
      model: "tts-1",
      apiBaseUrl: "https://api.openai.com/v1",
      enabled: true,
      priority: 0,
    },
  ];
}

const CHAT_PROVIDER_DEFAULT_MODEL: Partial<Record<ProviderId, string>> = {
  deepseek: "deepseek-v4-flash",
  doubao: "doubao-pro-32k",
  glm: "glm-4-flash",
  openai: "gpt-4o-mini",
  grsai: "gpt-4o-mini",
  ppio: "gpt-4o-mini",
  apimart: "gpt-4o-mini",
  aicanvas: "gpt-4o-mini",
};

const ADDABLE_CHAT_PROVIDER_IDS: ProviderId[] = [
  "deepseek",
  "doubao",
  "glm",
  "openai",
  "grsai",
  "ppio",
  "apimart",
  "aicanvas",
];

/** 可通过「添加对话服务商」选用的厂商（不含即梦等非 chat） */
export function listAddableChatProviderIds(existing: ProviderConfig[]): ProviderId[] {
  const have = new Set(existing.map((p) => p.id));
  return ADDABLE_CHAT_PROVIDER_IDS.filter(
    (id) => providerSupportsCapability(id, "chat") && !have.has(id),
  );
}

export function createChatProviderConfig(id: ProviderId): ProviderConfig {
  const meta = getProviderMeta(id);
  return {
    id,
    label: meta?.label ?? id,
    baseUrl: meta?.defaultUrl ?? "",
    model: CHAT_PROVIDER_DEFAULT_MODEL[id] ?? "gpt-4o-mini",
    priority: 100,
    enabled: true,
  };
}

function hasChatProvider(providers: ProviderConfig[]): boolean {
  return providers.some((p) => providerSupportsCapability(p.id, "chat"));
}

/** 已有列表时补全缺失的默认视频项（如仅配置了 Doubao、缺即梦 CLI） */
export function mergeMissingVideoModelPresets(models: ImageModelConfig[]): ImageModelConfig[] {
  return mergeMissingDreaminaVideoPresets(mergeMissingDoubaoVideoPreset(models));
}

function mergeMissingDoubaoVideoPreset(models: ImageModelConfig[]): ImageModelConfig[] {
  const presets = defaultVideoModelPresets().filter((p) => p.id === "preset-video-doubao-seedance");
  const missing = presets.filter((preset) => {
    return !models.some((m) => {
      if (m.id === preset.id) return true;
      if (isDoubaoSeedancePreset(m)) return true;
      const key = (m.model.trim() || m.id).trim();
      return key.length > 0 && key === preset.model.trim();
    });
  });
  return missing.length ? [...models, ...missing] : models;
}

/** 已有列表时补全缺失的即梦 CLI 图片项 */
export function mergeMissingImageModelPresets(models: ImageModelConfig[]): ImageModelConfig[] {
  return mergeMissingDreaminaImagePresets(models);
}

/** 空列表时填入推荐默认项（不覆盖用户已有配置） */
export function ensureModelListDefaults(settings: AppSettings): AppSettings {
  let next = settings;

  if (!hasChatProvider(next.providers)) {
    next = {
      ...next,
      providers: [
        {
          id: "deepseek",
          label: "DeepSeek",
          baseUrl: "https://api.deepseek.com/v1",
          model: "deepseek-v4-flash",
          priority: 0,
          enabled: true,
        },
      ],
      defaultProviderId: next.defaultProviderId ?? "deepseek",
    };
  }

  if ((next.imageModels ?? []).length === 0) {
    next = { ...next, imageModels: defaultImageModelPresets() };
  } else {
    const mergedImage = mergeMissingImageModelPresets(next.imageModels ?? []);
    if (mergedImage.length !== (next.imageModels ?? []).length) {
      next = { ...next, imageModels: mergedImage };
    }
  }

  if ((next.videoModels ?? []).length === 0) {
    next = { ...next, videoModels: defaultVideoModelPresets() };
  } else {
    const mergedVideo = mergeMissingVideoModelPresets(next.videoModels ?? []);
    if (mergedVideo.length !== (next.videoModels ?? []).length) {
      next = { ...next, videoModels: mergedVideo };
    }
  }

  if ((next.audioModels ?? []).length === 0) {
    next = { ...next, audioModels: defaultAudioModelPresets() };
  }

  return next;
}
