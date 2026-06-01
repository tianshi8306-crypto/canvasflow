/** @deprecated iter-40 起 Hermes 始终自动执行计划；字段仅作存储兼容 */
export type HermesDirectorPrefs = {
  autoRunLowRisk: boolean;
  directorMode: boolean;
};

export const HERMES_DIRECTOR_PREFS_STORAGE_KEY = "canvasflow.hermesDirector.v1";

export function defaultHermesDirectorPrefs(): HermesDirectorPrefs {
  return { autoRunLowRisk: true, directorMode: true };
}

export function loadHermesDirectorPrefs(): HermesDirectorPrefs {
  if (typeof localStorage === "undefined") return defaultHermesDirectorPrefs();
  try {
    const raw = localStorage.getItem(HERMES_DIRECTOR_PREFS_STORAGE_KEY);
    if (!raw) return defaultHermesDirectorPrefs();
    const parsed = JSON.parse(raw) as Partial<HermesDirectorPrefs>;
    return {
      autoRunLowRisk: Boolean(parsed.autoRunLowRisk),
      directorMode: Boolean(parsed.directorMode),
    };
  } catch {
    return defaultHermesDirectorPrefs();
  }
}

export function saveHermesDirectorPrefs(prefs: HermesDirectorPrefs): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(HERMES_DIRECTOR_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* quota */
  }
}
