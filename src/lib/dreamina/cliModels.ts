import type { ImageModelConfig } from "@/lib/settingsPanelTypes";

/** 即梦 CLI text2image --model_version（画布仅保留最新两版） */
export const DREAMINA_CLI_TEXT2IMAGE_VERSIONS = ["5.0", "4.6"] as const;

/** 即梦 CLI image2image --model_version（与 text2image 精简集一致） */
export const DREAMINA_CLI_IMAGE2IMAGE_VERSIONS = ["4.6", "5.0"] as const;

/** 即梦 CLI 视频 --model_version（text2video / multimodal2video / image2video / frames2video 并集） */
export const DREAMINA_CLI_VIDEO_VERSIONS = [
  "seedance2.0",
  "seedance2.0fast",
  "seedance2.0_vip",
  "seedance2.0fast_vip",
  "3.0",
  "3.0fast",
  "3.0pro",
  "3.5pro",
] as const;

export type DreaminaCliText2ImageVersion = (typeof DREAMINA_CLI_TEXT2IMAGE_VERSIONS)[number];
export type DreaminaCliImage2ImageVersion = (typeof DREAMINA_CLI_IMAGE2IMAGE_VERSIONS)[number];
export type DreaminaCliVideoVersion = (typeof DREAMINA_CLI_VIDEO_VERSIONS)[number];

const IMAGE_VERSION_LABELS: Record<string, string> = {
  "3.0": "即梦 3.0",
  "3.1": "即梦 3.1",
  "4.0": "即梦 4.0",
  "4.1": "即梦 4.1",
  "4.5": "即梦 4.5",
  "4.6": "即梦 4.6",
  "5.0": "即梦 5.0",
};

const VIDEO_VERSION_LABELS: Record<string, string> = {
  "seedance2.0": "即梦 Seedance 2.0",
  "seedance2.0fast": "即梦 Seedance 2.0 Fast",
  "seedance2.0_vip": "即梦 Seedance 2.0 VIP",
  "seedance2.0fast_vip": "即梦 Seedance 2.0 Fast VIP",
  "3.0": "即梦 3.0",
  "3.0fast": "即梦 3.0 Fast",
  "3.0pro": "即梦 3.0 Pro",
  "3.5pro": "即梦 3.5 Pro",
};

export function dreaminaCliModelId(version: string): string {
  return `dreamina/${version}`;
}

export function dreaminaCliImageLabel(version: string): string {
  return `${IMAGE_VERSION_LABELS[version] ?? `即梦 ${version}`}（CLI）`;
}

export function dreaminaCliVideoLabel(version: string): string {
  return `${VIDEO_VERSION_LABELS[version] ?? `即梦 ${version}`}（CLI）`;
}

export function dreaminaImageSupportsImageToImage(version: string): boolean {
  return (DREAMINA_CLI_IMAGE2IMAGE_VERSIONS as readonly string[]).includes(version);
}

function presetId(kind: "image" | "video", version: string): string {
  const slug = version.replace(/\./g, "-").replace(/_/g, "-");
  return `preset-${kind}-dreamina-${slug}`;
}

export function buildDreaminaImageModelPreset(version: string, priority: number): ImageModelConfig {
  return {
    id: presetId("image", version),
    vendorName: "即梦",
    modelName: "dreamina",
    modelVariant: version,
    label: dreaminaCliImageLabel(version),
    model: dreaminaCliModelId(version),
    apiBaseUrl: "",
    enabled: true,
    priority,
    supportsMultiRefFusion: dreaminaImageSupportsImageToImage(version),
    maxReferenceImages: 4,
    supportsImageEdit: dreaminaImageSupportsImageToImage(version),
  };
}

export function buildDreaminaVideoModelPreset(version: string, priority: number): ImageModelConfig {
  return {
    id: presetId("video", version),
    vendorName: "即梦",
    modelName: "dreamina",
    modelVariant: version,
    label: dreaminaCliVideoLabel(version),
    model: dreaminaCliModelId(version),
    apiBaseUrl: "",
    enabled: true,
    priority,
  };
}

export function defaultDreaminaImageModelPresets(basePriority = 10): ImageModelConfig[] {
  return DREAMINA_CLI_TEXT2IMAGE_VERSIONS.map((version, index) =>
    buildDreaminaImageModelPreset(version, basePriority + index),
  );
}

export function defaultDreaminaVideoModelPresets(basePriority = 10): ImageModelConfig[] {
  return DREAMINA_CLI_VIDEO_VERSIONS.map((version, index) =>
    buildDreaminaVideoModelPreset(version, basePriority + index),
  );
}

export function dreaminaCliImageOptions(): { id: string; label: string }[] {
  return DREAMINA_CLI_TEXT2IMAGE_VERSIONS.map((version) => ({
    id: dreaminaCliModelId(version),
    label: dreaminaCliImageLabel(version),
  }));
}

export function dreaminaCliVideoOptions(): { id: string; label: string }[] {
  return DREAMINA_CLI_VIDEO_VERSIONS.map((version) => ({
    id: dreaminaCliModelId(version),
    label: dreaminaCliVideoLabel(version),
  }));
}

function modelKey(m: ImageModelConfig): string {
  return (m.model.trim() || m.id).trim();
}

/** 已有列表时补全缺失的即梦 CLI 图片项 */
export function mergeMissingDreaminaImagePresets(models: ImageModelConfig[]): ImageModelConfig[] {
  const presets = defaultDreaminaImageModelPresets();
  const missing = presets.filter(
    (preset) =>
      !models.some((m) => m.id === preset.id || modelKey(m) === preset.model.trim()),
  );
  return missing.length ? [...models, ...missing] : models;
}

/** 已有列表时补全缺失的即梦 CLI 视频项 */
export function mergeMissingDreaminaVideoPresets(models: ImageModelConfig[]): ImageModelConfig[] {
  const presets = defaultDreaminaVideoModelPresets();
  const missing = presets.filter(
    (preset) =>
      !models.some((m) => m.id === preset.id || modelKey(m) === preset.model.trim()),
  );
  return missing.length ? [...models, ...missing] : models;
}
