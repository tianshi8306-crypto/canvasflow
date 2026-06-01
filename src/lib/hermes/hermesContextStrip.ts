import { formatPipelinePhaseHeadline } from "@/lib/hermes/hermesGlobalUnderstanding";
import { filterGapsForSituationCard } from "@/lib/hermes/hermesProactivePolicy";
import type { HermesSituation } from "@/lib/hermes/hermesSituation";

export type HermesContextStripTone = "neutral" | "warn" | "block";

const STRIP_MAX_CHARS = 96;

export function shouldShowHermesContextStrip(projectPath: string | null): boolean {
  return Boolean(projectPath?.trim());
}

export function resolveHermesContextStripTone(
  situation: HermesSituation,
): HermesContextStripTone {
  const visible = filterGapsForSituationCard(situation.gaps);
  if (visible.some((g) => g.severity === "block")) return "block";
  if (visible.some((g) => g.severity === "warn")) return "warn";
  return "neutral";
}

/** 浮窗 composer 上方一行：阶段 + 制片短句（非 gap 列表） */
export function formatHermesContextStripLine(situation: HermesSituation): string {
  const phaseLine = formatPipelinePhaseHeadline(situation);
  const raw = phaseLine ? `${phaseLine} — ${situation.headline}` : situation.headline;
  if (raw.length <= STRIP_MAX_CHARS) return raw;
  return `${raw.slice(0, STRIP_MAX_CHARS - 1)}…`;
}
