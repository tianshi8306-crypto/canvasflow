import { BATCH_FAV_MAX, BATCH_PRESETS_STORAGE_KEY } from "./scriptWorkbenchConstants";
import type { BatchPresetsStored } from "./scriptWorkbenchTypes";

function normalizeFavList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((x) => x.trim())
    .filter((x, i, a) => a.indexOf(x) === i)
    .slice(0, BATCH_FAV_MAX);
}

export function loadBatchPresetsV1(): BatchPresetsStored {
  if (typeof window === "undefined" || !window.localStorage) {
    return { cameraMove: [] };
  }
  try {
    const raw = window.localStorage.getItem(BATCH_PRESETS_STORAGE_KEY);
    if (!raw) return { cameraMove: [] };
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return { cameraMove: [] };
    const o = parsed as Record<string, unknown>;
    return {
      cameraMove: normalizeFavList(o.cameraMove),
    };
  } catch {
    return { cameraMove: [] };
  }
}

export function saveBatchPresetsV1(next: BatchPresetsStored) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const payload: BatchPresetsStored = {
      cameraMove: normalizeFavList(next.cameraMove),
    };
    window.localStorage.setItem(BATCH_PRESETS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* 忽略配额或隐私模式 */
  }
}
