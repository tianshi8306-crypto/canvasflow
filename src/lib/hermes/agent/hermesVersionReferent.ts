import type { HermesScriptVersionEntry } from "@/lib/hermes/agent/hermesScriptVersion";
import { getCachedHermesWorkstate } from "@/lib/hermes/agent/hermesWorkstate";
import { normalizeScriptBeats } from "@/lib/scriptBeatHelpers";

/** iter-104：上一版脚本快照中的画面/运镜，供「和上一版一样」指代 */
export type HermesVersionStyleSnapshot = {
  shotNumber: string;
  visualPrompt?: string;
  videoMotionPrompt?: string;
};

export type HermesVersionStyleReferent = {
  olderVersionId: string;
  snapshots: HermesVersionStyleSnapshot[];
  at: string;
};

export const VERSION_REFERENT_TTL_MS = 7 * 24 * 60 * 60_000;

const VERSION_REFERENT_RE =
  /上一版|上一版本|和上一版|跟上一版|像上一版|恢复上一版|回到上一版|上一快照|原先那版|之前那版|改回(?:去|到)?(?:上一版|之前)/;

export function messageHasVersionReferent(text: string): boolean {
  return VERSION_REFERENT_RE.test(text.trim());
}

export function isVersionStyleReferentFresh(
  referent: HermesVersionStyleReferent | undefined,
): boolean {
  if (!referent?.snapshots?.length) return false;
  const t = Date.parse(referent.at);
  return Number.isFinite(t) && Date.now() - t < VERSION_REFERENT_TTL_MS;
}

export function buildVersionStyleReferentFromEntry(
  older: HermesScriptVersionEntry,
): HermesVersionStyleReferent {
  const beats = normalizeScriptBeats(older.payload.scriptBeats);
  const beatNum = new Map(
    beats.map((b, i) => [b.id, (b.shotNumber ?? "").trim() || String(i + 1)]),
  );
  const motionByBeat = new Map(
    beats.map((b) => [b.id, (b.videoMotionPrompt ?? "").trim() || undefined]),
  );
  const snapshots: HermesVersionStyleSnapshot[] = [];
  for (const shot of older.payload.storyboardShots ?? []) {
    const shotNumber = beatNum.get(shot.scriptBeatId);
    if (!shotNumber) continue;
    const visual = shot.visualPrompt?.trim();
    const motion = motionByBeat.get(shot.scriptBeatId);
    if (!visual && !motion) continue;
    snapshots.push({
      shotNumber,
      visualPrompt: visual?.slice(0, 160),
      videoMotionPrompt: motion?.slice(0, 160),
    });
  }
  return {
    olderVersionId: older.id,
    snapshots: snapshots.slice(0, 24),
    at: new Date().toISOString(),
  };
}

export function resolveVersionSnapshotForShot(
  referent: HermesVersionStyleReferent | undefined,
  shotNumber: number,
): HermesVersionStyleSnapshot | undefined {
  if (!isVersionStyleReferentFresh(referent)) return undefined;
  const key = String(shotNumber);
  return referent!.snapshots.find((s) => s.shotNumber === key);
}

export function formatVersionStyleReferentForPrompt(
  referent: HermesVersionStyleReferent | undefined,
): string {
  if (!isVersionStyleReferentFresh(referent)) return "";
  const shortId = referent!.olderVersionId.slice(0, 12);
  const sample = referent!.snapshots
    .slice(0, 3)
    .map((s) => {
      const parts = [`镜 ${s.shotNumber}`];
      if (s.visualPrompt) parts.push(`画面：${s.visualPrompt.slice(0, 48)}`);
      if (s.videoMotionPrompt) parts.push(`运镜：${s.videoMotionPrompt.slice(0, 32)}`);
      return parts.join(" ");
    })
    .join("；");
  return `上一版脚本快照（\`${shortId}\`，用户说「和上一版一样」时优先）：${sample}`;
}

export function getCachedVersionStyleReferent():
  | HermesVersionStyleReferent
  | undefined {
  return getCachedHermesWorkstate()?.lastVersionStyleReferent;
}
