import { IMAGE_MODEL_OPTIONS } from "@/lib/imageGeneration/catalog";
import {
  imageModelEstimateLabel,
  imageModelIconLetter,
  imageModelSubtitle,
} from "@/lib/imageGeneration/imageModelDisplay";
import type { ImageModelOption } from "@/hooks/useImageModels";
import type { ImageModelConfig } from "@/lib/settingsPanelTypes";

export function buildBuiltinImageModels(): ImageModelOption[] {
  return IMAGE_MODEL_OPTIONS.map((m, sortIndex) => ({
    id: m.id,
    label: m.label,
    subtitle: undefined,
    estimateLabel: "30s",
    iconLetter: (m.label.trim() || m.id).charAt(0).toUpperCase(),
    sortIndex,
    settingsId: null,
    model: m.id,
    priority: 0,
    enabled: true,
    supportsMultiRefFusion: true,
    maxReferenceImages: 4,
    supportsImageEdit: true,
  }));
}

export function normalizeImageModelsFromSettings(configs: ImageModelConfig[]): ImageModelOption[] {
  return (configs ?? []).map((m, sortIndex) => ({
    id: `custom:${m.id}`,
    label: m.label?.trim() || m.model?.trim() || m.id,
    subtitle: imageModelSubtitle(m),
    estimateLabel: imageModelEstimateLabel(m),
    iconLetter: imageModelIconLetter(m),
    sortIndex: sortIndex + IMAGE_MODEL_OPTIONS.length,
    settingsId: m.id,
    model: m.model,
    priority: m.priority,
    enabled: m.enabled,
    supportsMultiRefFusion: m.supportsMultiRefFusion !== false,
    maxReferenceImages: Math.min(4, Math.max(1, m.maxReferenceImages ?? 4)),
    supportsImageEdit: m.supportsImageEdit !== false,
  }));
}
