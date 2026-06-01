import type { VideoGenOutputSpec, VideoGenerationWorkflow } from "@/lib/videoNodeTypes";
import { SEEDANCE_OUTPUT_DURATION_MAX, SEEDANCE_OUTPUT_DURATION_MIN } from "@/lib/seedance/validation";

export type VideoCatalogResolution = "720P" | "1080P";

export type VideoModelCapabilities = {
  durationMinSec: number;
  durationMaxSec: number;
  resolutions: readonly VideoCatalogResolution[];
  supportedWorkflows?: VideoGenerationWorkflow[];
};

const SEEDANCE_CAPABILITIES: VideoModelCapabilities = {
  durationMinSec: SEEDANCE_OUTPUT_DURATION_MIN,
  durationMaxSec: SEEDANCE_OUTPUT_DURATION_MAX,
  resolutions: ["720P", "1080P"],
};

/** Seedance 系模型能力（480P 不支持，见 seedance-params.md） */
export function getVideoModelCapabilities(_modelId: string): VideoModelCapabilities {
  return SEEDANCE_CAPABILITIES;
}

export function formatVideoModelCapabilitySubtitle(
  modelId: string,
  _workflow?: VideoGenerationWorkflow,
): string {
  const cap = getVideoModelCapabilities(modelId);
  return `${cap.durationMinSec}–${cap.durationMaxSec}s · ${cap.resolutions.join("/")}`;
}

export function isCatalogResolutionSupported(modelId: string, resolution: string): boolean {
  if (resolution === "480P") return false;
  return getVideoModelCapabilities(modelId).resolutions.includes(resolution as VideoCatalogResolution);
}

export function supportedCatalogResolutions(modelId: string): ("480P" | "720P" | "1080P")[] {
  const cap = getVideoModelCapabilities(modelId);
  return cap.resolutions as ("720P" | "1080P")[];
}

export function clampVideoDurationForModel(modelId: string, durationSec: number): number {
  if (durationSec === -1) return -1;
  const cap = getVideoModelCapabilities(modelId);
  return Math.min(cap.durationMaxSec, Math.max(cap.durationMinSec, durationSec));
}

export type NormalizeVideoOutputResult = {
  output: VideoGenOutputSpec;
  adjusted: boolean;
  message?: string;
};

/** 将 draft.output 钳制到当前模型 catalog 能力内 */
export function normalizeVideoOutputForModel(
  modelId: string,
  output: VideoGenOutputSpec,
): NormalizeVideoOutputResult {
  const cap = getVideoModelCapabilities(modelId);
  let adjusted = false;
  const messages: string[] = [];
  const next = { ...output };

  if (!isCatalogResolutionSupported(modelId, next.resolution)) {
    next.resolution = cap.resolutions[0] ?? "720P";
    adjusted = true;
    messages.push(`已切换为 ${next.resolution}（当前模型不支持 ${output.resolution}）`);
  }

  if (next.durationSec !== -1) {
    const clamped = clampVideoDurationForModel(modelId, next.durationSec);
    if (clamped !== next.durationSec) {
      next.durationSec = clamped;
      adjusted = true;
      messages.push(`时长已调整为 ${clamped}s`);
    }
  }

  return {
    output: next,
    adjusted,
    message: messages.length ? messages.join("；") : undefined,
  };
}
