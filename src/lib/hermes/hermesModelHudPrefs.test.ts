import { describe, expect, it, beforeEach } from "vitest";
import {
  defaultHermesModelHudPrefs,
  hermesModelHudHasVisibleContent,
  loadHermesModelHudPrefs,
  patchHermesModelHudPrefs,
  saveHermesModelHudPrefs,
} from "@/lib/hermes/hermesModelHudPrefs";

const KEY = "canvasflow.hermesModelHud.v1";

describe("hermesModelHudPrefs", () => {
  beforeEach(() => {
    localStorage.removeItem(KEY);
  });

  it("defaults to HUD hidden with detail fields on", () => {
    const d = defaultHermesModelHudPrefs();
    expect(d.showHud).toBe(false);
    expect(d.showModel).toBe(true);
    expect(hermesModelHudHasVisibleContent(d)).toBe(false);
  });

  it("persists patch", () => {
    patchHermesModelHudPrefs({ showHud: true, showModel: false });
    const loaded = loadHermesModelHudPrefs();
    expect(loaded.showHud).toBe(true);
    expect(loaded.showModel).toBe(false);
  });

  it("showHud with all details off except mark is visible", () => {
    saveHermesModelHudPrefs({
      ...defaultHermesModelHudPrefs(),
      showHud: true,
      showModel: false,
      showScope: false,
      showSessionUsage: false,
      showQuotaHint: false,
      showBalanceLink: false,
      showHermesMark: true,
    });
    expect(hermesModelHudHasVisibleContent(loadHermesModelHudPrefs())).toBe(true);
  });
});
