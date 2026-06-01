import { DOUBAO_SEEDANCE_API_MODEL } from "@/lib/videoGeneration/seedanceApiModel";
import type { ImageModelConfig } from "./settingsPanelTypes";

export function newImageModelTemplate(): ImageModelConfig {
  return {
    id: `image-model-${Date.now()}`,
    vendorName: "",
    modelName: "",
    modelVariant: "",
    label: "",
    model: "",
    apiBaseUrl: "",
    enabled: true,
    priority: 0,
    supportsMultiRefFusion: true,
    maxReferenceImages: 4,
    supportsImageEdit: true,
  };
}

export function newAudioModelTemplate(): ImageModelConfig {
  return {
    id: `audio-model-${Date.now()}`,
    vendorName: "",
    modelName: "",
    modelVariant: "",
    label: "TTS 模型",
    model: "tts-1",
    apiBaseUrl: "https://api.openai.com/v1",
    enabled: true,
    priority: 0,
  };
}

export function newVideoModelTemplate(): ImageModelConfig {
  return {
    id: `video-model-${Date.now()}`,
    vendorName: "",
    modelName: "",
    modelVariant: "",
    label: "视频模型",
    model: DOUBAO_SEEDANCE_API_MODEL,
    apiBaseUrl: "",
    enabled: true,
    priority: 0,
  };
}
