import type { ImageModelConfig } from "@/lib/settingsPanelTypes";

const ESTIMATE_BY_VARIANT: Record<string, string> = {
  "Doubao-Seedream-5.0-lite": "20s",
  seedream: "20s",
  "gpt-image": "25s",
  nano: "15s",
  pro: "50s",
};

export function imageModelSubtitle(m: Pick<ImageModelConfig, "vendorName" | "modelName" | "modelVariant" | "model">): string | undefined {
  const parts = [m.vendorName?.trim(), m.modelVariant?.trim()].filter(Boolean);
  if (parts.length > 0) return parts.join(" · ");
  const name = m.modelName?.trim();
  if (name && name !== "自定义") return name;
  return undefined;
}

export function imageModelEstimateLabel(m: Pick<ImageModelConfig, "model" | "modelVariant" | "label">): string {
  const key = (m.modelVariant || m.model || m.label || "").toLowerCase();
  for (const [fragment, label] of Object.entries(ESTIMATE_BY_VARIANT)) {
    if (key.includes(fragment.toLowerCase())) return label;
  }
  return "30s";
}

export function imageModelIconLetter(m: Pick<ImageModelConfig, "vendorName" | "label" | "model">): string {
  const src = m.vendorName?.trim() || m.label?.trim() || m.model?.trim() || "?";
  return src.charAt(0).toUpperCase();
}
