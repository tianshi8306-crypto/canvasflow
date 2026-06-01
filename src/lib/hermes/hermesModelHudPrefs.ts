export type HermesModelHudPrefs = {
  /** 显示画布右上角模型状态条 */
  showHud: boolean;
  /** 对话模型（厂商 · 模型名） */
  showModel: boolean;
  /** 工程与 Tab 归属 */
  showScope: boolean;
  /** 本会话 Token 用量估算 */
  showSessionUsage: boolean;
  /** 余额 / 配额说明文案 */
  showQuotaHint: boolean;
  /** 「余额」快捷链接（需厂商提供控制台地址） */
  showBalanceLink: boolean;
  /** 左侧 H 圆形标识 */
  showHermesMark: boolean;
};

export const HERMES_MODEL_HUD_PREFS_UPDATED = "canvasflow-hermes-model-hud-prefs-updated";

const STORAGE_KEY = "canvasflow.hermesModelHud.v1";

export function defaultHermesModelHudPrefs(): HermesModelHudPrefs {
  return {
    showHud: false,
    showModel: true,
    showScope: true,
    showSessionUsage: true,
    showQuotaHint: true,
    showBalanceLink: true,
    showHermesMark: true,
  };
}

function normalizePrefs(raw: Partial<HermesModelHudPrefs> | null | undefined): HermesModelHudPrefs {
  const d = defaultHermesModelHudPrefs();
  if (!raw || typeof raw !== "object") return d;
  return {
    showHud: raw.showHud === true,
    showModel: raw.showModel !== false,
    showScope: raw.showScope !== false,
    showSessionUsage: raw.showSessionUsage !== false,
    showQuotaHint: raw.showQuotaHint !== false,
    showBalanceLink: raw.showBalanceLink !== false,
    showHermesMark: raw.showHermesMark !== false,
  };
}

export function loadHermesModelHudPrefs(): HermesModelHudPrefs {
  if (typeof localStorage === "undefined") return defaultHermesModelHudPrefs();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultHermesModelHudPrefs();
    return normalizePrefs(JSON.parse(raw) as Partial<HermesModelHudPrefs>);
  } catch {
    return defaultHermesModelHudPrefs();
  }
}

export function saveHermesModelHudPrefs(prefs: HermesModelHudPrefs): void {
  if (typeof localStorage === "undefined") return;
  const next = normalizePrefs(prefs);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(HERMES_MODEL_HUD_PREFS_UPDATED));
}

export function patchHermesModelHudPrefs(patch: Partial<HermesModelHudPrefs>): HermesModelHudPrefs {
  const next = normalizePrefs({ ...loadHermesModelHudPrefs(), ...patch });
  saveHermesModelHudPrefs(next);
  return next;
}

/** 开启 HUD 时是否至少有一项可见内容 */
export function hermesModelHudHasVisibleContent(prefs: HermesModelHudPrefs): boolean {
  if (!prefs.showHud) return false;
  return (
    prefs.showHermesMark ||
    prefs.showModel ||
    prefs.showScope ||
    prefs.showSessionUsage ||
    prefs.showQuotaHint ||
    prefs.showBalanceLink
  );
}
