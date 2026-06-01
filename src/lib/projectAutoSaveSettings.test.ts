import { describe, expect, it } from "vitest";
import {
  normalizeProjectAutoSaveIdleSec,
  projectAutoSaveDebounceMs,
  DEFAULT_PROJECT_AUTO_SAVE_IDLE_SEC,
} from "./projectAutoSaveSettings";

describe("projectAutoSaveSettings", () => {
  it("defaults to 2s debounce", () => {
    expect(DEFAULT_PROJECT_AUTO_SAVE_IDLE_SEC).toBe(2);
    expect(projectAutoSaveDebounceMs(DEFAULT_PROJECT_AUTO_SAVE_IDLE_SEC)).toBe(2000);
  });

  it("0 means disabled", () => {
    expect(normalizeProjectAutoSaveIdleSec(0)).toBe(0);
    expect(projectAutoSaveDebounceMs(0)).toBe(0);
  });

  it("snaps unknown values to nearest preset", () => {
    expect(normalizeProjectAutoSaveIdleSec(60)).toBe(60);
    expect(normalizeProjectAutoSaveIdleSec(999)).toBe(300);
  });
});
