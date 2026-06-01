import { TTS_DEFAULT_PROVIDER_MODEL_OPTIONS } from "@/lib/ttsModelCatalog";
import type { ImageModelConfig } from "@/lib/settingsPanelTypes";

export type AudioModelOption = {
  /** 下拉选项 id（内置 __provider_* 或 custom:${settingsId}） */
  id: string;
  label: string;
  audioModelId: string | null;
  ttsModel: string;
  enabled: boolean;
  isBuiltin: boolean;
};

function shortLabel(raw: string, model: string): string {
  const m = model.trim();
  if (raw.includes("Provider")) return m || raw;
  return (raw.trim() || m).slice(0, 40);
}

export function buildBuiltinAudioModels(): AudioModelOption[] {
  return TTS_DEFAULT_PROVIDER_MODEL_OPTIONS.map((o) => ({
    id: o.id,
    label: shortLabel(o.label, o.model),
    audioModelId: null,
    ttsModel: o.model,
    enabled: true,
    isBuiltin: true,
  }));
}

export function normalizeAudioModelsFromSettings(configs: ImageModelConfig[]): AudioModelOption[] {
  return (configs ?? [])
    .filter((m) => m.enabled && m.model.trim())
    .sort((a, b) => a.priority - b.priority)
    .map((m) => ({
      id: `custom:${m.id}`,
      label: `${m.label?.trim() || m.model}（自定义）`.slice(0, 40),
      audioModelId: m.id,
      ttsModel: m.model.trim(),
      enabled: m.enabled,
      isBuiltin: false,
    }));
}

export function mergeAudioModelOptions(custom: AudioModelOption[]): AudioModelOption[] {
  const customTts = new Set(custom.map((m) => m.ttsModel));
  return [
    ...buildBuiltinAudioModels().filter((b) => !customTts.has(b.ttsModel)),
    ...custom,
  ];
}
