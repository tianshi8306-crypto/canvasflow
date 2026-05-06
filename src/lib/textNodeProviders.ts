import { invoke, isTauri } from "@tauri-apps/api/core";

export type TextNodeProviderOption = {
  id: string;
  label: string;
  model: string;
  enabled: boolean;
  priority: number;
};

export function toEnabledProviderOptions(
  providers: TextNodeProviderOption[] | undefined,
): TextNodeProviderOption[] {
  return (providers ?? [])
    .filter((p) => p.enabled)
    .sort((a, b) => a.priority - b.priority);
}

export async function loadEnabledProviderOptions(): Promise<TextNodeProviderOption[]> {
  if (!isTauri()) return [];
  try {
    const settings = await invoke<{ providers?: TextNodeProviderOption[] }>("load_settings");
    return toEnabledProviderOptions(settings.providers);
  } catch {
    return [];
  }
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
