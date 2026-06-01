import type { DreaminaAuthState } from "@/lib/dreaminaAuth";

/** 打开设置页时：此时间内不调用 CLI 检测 */
export const DREAMINA_AUTH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** 超过此时长显示「建议刷新」 */
export const DREAMINA_AUTH_STALE_WARN_MS = 20 * 60 * 60 * 1000;

const STORAGE_KEY = "canvasflow.dreaminaAuthCache.v1";

export type DreaminaAuthCacheEntry = {
  checkedAt: number;
  state: Pick<
    DreaminaAuthState,
    "isLoggedIn" | "statusText" | "message" | "creditText" | "installed"
  >;
};

export function dreaminaAuthCacheAgeMs(checkedAt: number, now = Date.now()): number {
  return Math.max(0, now - checkedAt);
}

export function isDreaminaAuthCacheFresh(checkedAt: number, now = Date.now()): boolean {
  return dreaminaAuthCacheAgeMs(checkedAt, now) < DREAMINA_AUTH_CACHE_TTL_MS;
}

export function getDreaminaAuthStaleHint(checkedAt: number, now = Date.now()): string | null {
  const age = dreaminaAuthCacheAgeMs(checkedAt, now);
  if (age >= DREAMINA_AUTH_CACHE_TTL_MS) {
    return "登录状态记录已过期，请刷新或重新登录";
  }
  if (age >= DREAMINA_AUTH_STALE_WARN_MS) {
    return "登录状态可能已过期，建议点击「刷新状态」确认";
  }
  return null;
}

export function readDreaminaAuthCache(): DreaminaAuthCacheEntry | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DreaminaAuthCacheEntry;
    if (!parsed?.checkedAt || !parsed.state) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readDreaminaAuthFromCache(): DreaminaAuthState | null {
  const entry = readDreaminaAuthCache();
  if (!entry) return null;
  return dreaminaAuthStateFromCacheEntry(entry);
}

export function dreaminaAuthStateFromCacheEntry(entry: DreaminaAuthCacheEntry): DreaminaAuthState {
  return {
    ...entry.state,
    runtime: null,
    checkedAt: entry.checkedAt,
    fromCache: true,
    staleHint: null,
  };
}

export function writeDreaminaAuthCache(state: DreaminaAuthState, checkedAt = Date.now()): void {
  if (typeof localStorage === "undefined") return;
  const entry: DreaminaAuthCacheEntry = {
    checkedAt,
    state: {
      isLoggedIn: state.isLoggedIn,
      statusText: state.statusText,
      message: state.message,
      creditText: state.creditText,
      installed: state.installed,
    },
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    /* quota / private mode */
  }
}

export function clearDreaminaAuthCache(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function withDreaminaAuthMeta(
  state: DreaminaAuthState,
  checkedAt: number,
  fromCache: boolean,
): DreaminaAuthState {
  return {
    ...state,
    checkedAt,
    fromCache,
    staleHint: getDreaminaAuthStaleHint(checkedAt),
  };
}
