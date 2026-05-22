import type { ProviderCapability } from "@/features/settings/providerRouter";
import type { ProviderId } from "@/lib/providers";

/** 各厂商在画布节点中支持的模型能力（与设置「API 配置」卡片 id 对齐） */
const PROVIDER_CAPABILITIES: Record<ProviderId, ProviderCapability[]> = {
  openai: ["chat", "audio"],
  grsai: ["chat", "image"],
  ppio: ["chat", "image"],
  apimart: ["chat", "image", "video"],
  runninghub: ["image", "video"],
  runninghubwf: ["image", "video"],
  dreamina: ["image", "video"],
  aicanvas: ["chat", "image", "video"],
};

export function providerCapabilities(providerId: string): ProviderCapability[] {
  return PROVIDER_CAPABILITIES[providerId as ProviderId] ?? ["chat"];
}

export function providerSupportsCapability(
  providerId: string,
  capability: ProviderCapability,
): boolean {
  return providerCapabilities(providerId).includes(capability);
}
