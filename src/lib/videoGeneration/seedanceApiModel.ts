import type { ImageModelConfig } from "@/lib/settingsPanelTypes";

/** 画布 / catalog 内部标识（能力表、默认 draft.modelId） */
export const DOUBAO_SEEDANCE_CANONICAL_ID = "doubao_seedance_2_0";

/** 火山方舟 Seedance 2.0 推理接入点 model（见 docs/PROJECT_REFERENCE.md） */
export const DOUBAO_SEEDANCE_API_MODEL = "doubao-seedance-2-0-260128";

export function isDoubaoSeedancePreset(m: Pick<ImageModelConfig, "id" | "model">): boolean {
  const model = m.model.trim();
  return (
    m.id === "preset-video-doubao-seedance" ||
    model === DOUBAO_SEEDANCE_API_MODEL ||
    model === DOUBAO_SEEDANCE_CANONICAL_ID
  );
}

/** 加载 Settings 时把旧 slug 升级为真实 API model */
export function normalizeVideoModelConfigOnLoad(m: ImageModelConfig): ImageModelConfig {
  if (isDoubaoSeedancePreset(m) && m.model.trim() === DOUBAO_SEEDANCE_CANONICAL_ID) {
    return { ...m, model: DOUBAO_SEEDANCE_API_MODEL };
  }
  return m;
}
