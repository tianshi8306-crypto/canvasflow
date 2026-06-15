import {
  DEFAULT_PROJECT_AUTO_SAVE_IDLE_SEC,
  projectAutoSaveDebounceMs,
  type ProjectAutoSaveIdleSec,
} from "@/lib/projectAutoSaveSettings";
import type { ProjectState } from "./projectStoreTypes";
import { shouldDeferProjectAutoSave } from "./projectHistory";

let saveTimer: number | undefined;
let debounceMs = projectAutoSaveDebounceMs(DEFAULT_PROJECT_AUTO_SAVE_IDLE_SEC);

export function setProjectAutoSaveDebounceMs(ms: number) {
  debounceMs = ms > 0 ? ms : 0;
}

export function applyProjectAutoSaveIdleSec(idleSec: ProjectAutoSaveIdleSec) {
  setProjectAutoSaveDebounceMs(projectAutoSaveDebounceMs(idleSec));
}

export function getProjectAutoSaveDebounceMs(): number {
  return debounceMs;
}

export function scheduleSave(get: () => ProjectState) {
  if (debounceMs <= 0) return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    tryRunScheduledSave(get);
  }, debounceMs);
}

const DEFER_POLL_MS = 400;

function tryRunScheduledSave(get: () => ProjectState) {
  if (!get().projectDirty) return;
  if (shouldDeferProjectAutoSave()) {
    saveTimer = window.setTimeout(() => tryRunScheduledSave(get), DEFER_POLL_MS);
    return;
  }
  void get().saveProject();
}

export function cancelScheduledSave() {
  window.clearTimeout(saveTimer);
  saveTimer = undefined;
}

/** 立即保存（用于视频任务提交、关闭画布前等需要立刻落盘 activeJob 的场景） */
export async function flushProjectSave(get: () => ProjectState): Promise<void> {
  cancelScheduledSave();
  if (!get().projectPath) return;
  await get().saveProject();
}
