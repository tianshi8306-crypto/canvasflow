import type { ProjectState } from "./projectStoreTypes";

let saveTimer: number | undefined;

export function scheduleSave(get: () => ProjectState) {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    void get().saveProject();
  }, 450);
}
