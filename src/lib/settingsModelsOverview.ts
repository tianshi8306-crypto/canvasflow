import type { ProviderCapability } from "@/features/settings/providerRouter";
import { providerCapabilities, providerSupportsCapability } from "@/lib/providerCapabilities";
import type { AppSettings } from "@/lib/settingsPanelTypes";

export type SettingsModelsTabId = "overview" | "chat" | "image" | "video" | "audio";

export type ModelLaneStatus = {
  id: SettingsModelsTabId;
  configured: number;
  enabled: number;
  ready: boolean;
};

const CAPABILITY_LABEL: Record<ProviderCapability, string> = {
  chat: "对话",
  image: "图片",
  video: "视频",
  audio: "语音",
};

export function capabilityLabels(providerId: string): string[] {
  return providerCapabilities(providerId).map((c) => CAPABILITY_LABEL[c]);
}

export function summarizeModelLanes(settings: AppSettings): ModelLaneStatus[] {
  const chatProviders = settings.providers.filter((p) => providerSupportsCapability(p.id, "chat"));
  const chatReady = chatProviders.some((p) => p.enabled && p.model.trim());

  const imageModels = settings.imageModels ?? [];
  const imageReady = imageModels.some((m) => m.enabled && (m.model.trim() || m.modelVariant.trim()));

  const videoModels = settings.videoModels ?? [];
  const videoReady = videoModels.some((m) => m.enabled && m.model.trim());

  const audioModels = settings.audioModels ?? [];
  const audioReady =
    audioModels.some((m) => m.enabled && m.model.trim()) ||
    settings.providers.some((p) => p.enabled && providerSupportsCapability(p.id, "audio"));

  return [
    {
      id: "chat",
      configured: chatProviders.length,
      enabled: chatProviders.filter((p) => p.enabled).length,
      ready: chatReady,
    },
    {
      id: "image",
      configured: imageModels.length,
      enabled: imageModels.filter((m) => m.enabled).length,
      ready: imageReady,
    },
    {
      id: "video",
      configured: videoModels.length,
      enabled: videoModels.filter((m) => m.enabled).length,
      ready: videoReady,
    },
    {
      id: "audio",
      configured: audioModels.length,
      enabled: audioModels.filter((m) => m.enabled).length,
      ready: audioReady,
    },
  ];
}
