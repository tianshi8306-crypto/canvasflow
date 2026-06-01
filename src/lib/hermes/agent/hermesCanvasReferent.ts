import type { HermesCanvasEvent } from "@/lib/hermes/agent/hermesCanvasEvents";
import type { HermesCanvasReferent } from "@/lib/hermes/agent/hermesWorkstate";

export const CANVAS_REFERENT_TTL_MS = 45 * 60_000;

/** 将事件或选中里的镜号标签解析为 1-based 镜号 */
export function parseShotNumberFromLabel(label: string | undefined): number | null {
  if (!label?.trim()) return null;
  const t = label.trim();
  const direct = /^\d+$/.exec(t);
  if (direct) {
    const n = parseInt(direct[0]!, 10);
    return n >= 1 && n < 200 ? n : null;
  }
  const embedded = /(\d+)/.exec(t);
  if (!embedded) return null;
  const n = parseInt(embedded[1]!, 10);
  return n >= 1 && n < 200 ? n : null;
}

export function referentFromCanvasEvent(
  event: HermesCanvasEvent,
): HermesCanvasReferent | null {
  if (!event.shotNumber?.trim()) return null;
  return {
    shotNumber: event.shotNumber.trim(),
    beatId: event.beatId,
    source: event.kind === "selection_focused" ? "selection" : "canvas_edit",
    at: event.at,
  };
}

export function pickLatestReferentFromEvents(
  events: HermesCanvasEvent[],
): HermesCanvasReferent | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const r = referentFromCanvasEvent(events[i]!);
    if (r) return r;
  }
  return null;
}

export function mergeCanvasReferent(
  prev: HermesCanvasReferent | undefined,
  next: HermesCanvasReferent | null,
): HermesCanvasReferent | undefined {
  if (!next) return prev;
  if (!prev) return next;
  const prevT = Date.parse(prev.at);
  const nextT = Date.parse(next.at);
  if (Number.isFinite(prevT) && Number.isFinite(nextT) && prevT > nextT) {
    return prev;
  }
  return next;
}

export function isCanvasReferentFresh(
  referent: HermesCanvasReferent | undefined,
): boolean {
  if (!referent?.shotNumber?.trim()) return false;
  const t = Date.parse(referent.at);
  return Number.isFinite(t) && Date.now() - t < CANVAS_REFERENT_TTL_MS;
}

export function formatCanvasReferentForPrompt(
  referent: HermesCanvasReferent | undefined,
): string {
  if (!isCanvasReferentFresh(referent)) return "";
  const srcLabel =
    referent!.source === "selection"
      ? "选中"
      : referent!.source === "tool"
        ? "最近工具操作"
        : referent!.source === "plan"
          ? "最近计划"
          : "手改分镜";
  return `对话指代默认镜：镜 ${referent!.shotNumber}（${srcLabel}；用户说「那镜/刚才」且无明确镜号时优先）`;
}

export function referentFromPlanBeatIds(
  beatIds: unknown,
): HermesCanvasReferent | null {
  if (!Array.isArray(beatIds) || beatIds.length === 0) return null;
  const first = beatIds[0];
  if (typeof first !== "number" || first < 1 || first >= 200) return null;
  return {
    shotNumber: String(first),
    source: "plan",
    at: new Date().toISOString(),
  };
}
