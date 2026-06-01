import type { HermesProductionSnapshot } from "@/lib/hermes/hermesSituation";

export type HermesOrbSuggestion = {
  id: string;
  severity: "warn" | "info" | "success";
  message: string;
  actionLabel: string;
  actionPrompt: string;
};

export function productionFingerprint(p: HermesProductionSnapshot): string {
  return [
    p.beatCount,
    p.storyboardReady,
    p.storyboardMissing,
    p.storyboardFailed,
    p.imageReady,
    p.imageMissing,
    p.videoGenerated,
    p.videoFailed,
    p.videoEligible,
  ].join(":");
}
