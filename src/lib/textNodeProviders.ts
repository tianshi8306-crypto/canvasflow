import { invoke, isTauri } from "@tauri-apps/api/core";
import type { ProviderCapability } from "@/features/settings/providerRouter";
import { providerSupportsCapability } from "@/lib/providerCapabilities";

export type TextNodeProviderOption = {
  id: string;
  label: string;
  model: string;
  enabled: boolean;
  priority: number;
};

export function toEnabledProviderOptions(
  providers: TextNodeProviderOption[] | undefined,
  capability: ProviderCapability = "chat",
): TextNodeProviderOption[] {
  return (providers ?? [])
    .filter((p) => p.enabled && providerSupportsCapability(p.id, capability))
    .sort((a, b) => a.priority - b.priority);
}

export async function loadEnabledProviderOptions(
  capability: ProviderCapability = "chat",
): Promise<TextNodeProviderOption[]> {
  if (!isTauri()) return [];
  try {
    const settings = await invoke<{ providers?: TextNodeProviderOption[] }>("load_settings");
    return toEnabledProviderOptions(settings.providers, capability);
  } catch {
    return [];
  }
}

/** 文本 / 脚本 / LLM 节点：仅语言模型 Provider */
export async function loadEnabledChatProviderOptions(): Promise<TextNodeProviderOption[]> {
  return loadEnabledProviderOptions("chat");
}

export function getProviderSelectionPatch(
  providerId: string,
  providerOptions: TextNodeProviderOption[],
): { providerId?: string; model?: string } {
  if (!providerId) {
    return { providerId: undefined, model: undefined };
  }
  const picked = providerOptions.find((p) => p.id === providerId);
  return {
    providerId,
    ...(picked?.model?.trim() ? { model: picked.model.trim() } : {}),
  };
}
