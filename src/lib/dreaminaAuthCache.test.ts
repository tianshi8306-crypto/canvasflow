import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DREAMINA_AUTH_CACHE_TTL_MS,
  DREAMINA_AUTH_STALE_WARN_MS,
  clearDreaminaAuthCache,
  getDreaminaAuthStaleHint,
  isDreaminaAuthCacheFresh,
  readDreaminaAuthCache,
  writeDreaminaAuthCache,
} from "./dreaminaAuthCache";
import type { DreaminaAuthState } from "./dreaminaAuth";

const sample: DreaminaAuthState = {
  isLoggedIn: true,
  statusText: "已登录",
  message: "ok",
  creditText: "额度：100",
  installed: true,
  runtime: null,
};

describe("dreaminaAuthCache", () => {
  afterEach(() => {
    clearDreaminaAuthCache();
    vi.useRealTimers();
  });

  it("fresh within TTL", () => {
    const now = 1_700_000_000_000;
    vi.setSystemTime(now);
    writeDreaminaAuthCache(sample, now);
    expect(isDreaminaAuthCacheFresh(now)).toBe(true);
    expect(readDreaminaAuthCache()?.state.isLoggedIn).toBe(true);
  });

  it("stale hint before hard expire", () => {
    const checkedAt = 1_700_000_000_000;
    const warnAt = checkedAt + DREAMINA_AUTH_STALE_WARN_MS + 1;
    expect(getDreaminaAuthStaleHint(checkedAt, warnAt)).toMatch(/建议/);
  });

  it("hard expired hint", () => {
    const checkedAt = 1_700_000_000_000;
    const expiredAt = checkedAt + DREAMINA_AUTH_CACHE_TTL_MS + 1;
    expect(getDreaminaAuthStaleHint(checkedAt, expiredAt)).toMatch(/已过期/);
  });
});
