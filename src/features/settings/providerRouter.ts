export type ProviderCapability = "chat" | "image" | "video" | "audio";

export type ProviderProfile = {
  id: string;
  label: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
  priority: number;
  capabilities: ProviderCapability[];
};

export function pickProvider(
  profiles: ProviderProfile[],
  capability: ProviderCapability,
): ProviderProfile | null {
  return (
    [...profiles]
      .filter((p) => p.enabled && p.capabilities.includes(capability))
      .sort((a, b) => a.priority - b.priority)[0] ?? null
  );
}
