import { afterEach, describe, expect, it } from "vitest";
import {
  defaultHermesShellPrefs,
  loadHermesShellPrefs,
  saveHermesShellPrefs,
} from "./hermesShellPrefs";

describe("hermesShellPrefs", () => {
  afterEach(() => {
    localStorage.removeItem("canvasflow.hermesShell.v2");
    localStorage.removeItem("canvasflow.hermesShell.v1");
  });

  it("defaults to idle with orb dock", () => {
    const prefs = defaultHermesShellPrefs();
    expect(prefs.mode).toBe("idle");
    expect(prefs.orbDock).toEqual({ x: -1, y: -1 });
  });

  it("migrates v1 prefs to v2 idle spirit state", () => {
    localStorage.setItem(
      "canvasflow.hermesShell.v1",
      JSON.stringify({
        mode: "expanded",
        panelWidth: 360,
        orbDock: { right: 20, bottom: 90 },
      }),
    );
    const loaded = loadHermesShellPrefs();
    expect(loaded.mode).toBe("idle");
    expect(loaded.orbDock.x).toBe(-1);
    expect(localStorage.getItem("canvasflow.hermesShell.v2")).toBeTruthy();
  });

  it("persists panel width and float dock only; spirit resets on load", () => {
    saveHermesShellPrefs({
      mode: "expanded",
      panelWidth: 400,
      orbDock: { x: 40, y: 120 },
      floatDock: { x: 120, y: 80 },
    });
    const loaded = loadHermesShellPrefs();
    expect(loaded.mode).toBe("idle");
    expect(loaded.panelWidth).toBe(400);
    expect(loaded.orbDock).toEqual({ x: -1, y: -1 });
    expect(loaded.floatDock).toEqual({ x: 120, y: 80 });
    const raw = JSON.parse(localStorage.getItem("canvasflow.hermesShell.v2") ?? "{}") as Record<
      string,
      unknown
    >;
    expect(raw.mode).toBeUndefined();
    expect(raw.orbDock).toBeUndefined();
  });
});
