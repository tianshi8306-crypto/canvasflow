import { beforeEach, describe, expect, it, vi } from "vitest";

const { checkMock, getVersionMock, isTauriMock } = vi.hoisted(() => ({
  checkMock: vi.fn(),
  getVersionMock: vi.fn(),
  isTauriMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: isTauriMock,
}));

vi.mock("@tauri-apps/api/app", () => ({
  getVersion: getVersionMock,
}));

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: checkMock,
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: vi.fn(),
}));

import {
  checkForAppUpdateOnceAtStartup,
  clearStartupUpdateCheckFlag,
  isUpdateSkipped,
  markUpdateSkipped,
} from "@/lib/appUpdater";

describe("appUpdater", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    isTauriMock.mockReturnValue(true);
    getVersionMock.mockResolvedValue("0.1.0");
  });

  it("checks only once per session", async () => {
    checkMock.mockResolvedValue(null);

    await checkForAppUpdateOnceAtStartup();
    await checkForAppUpdateOnceAtStartup();

    expect(checkMock).toHaveBeenCalledTimes(1);
  });

  it("returns null when update version was skipped", async () => {
    checkMock.mockResolvedValue({
      version: "0.2.0",
      body: "notes",
    });
    markUpdateSkipped("0.2.0");

    const result = await checkForAppUpdateOnceAtStartup();
    expect(result).toBeNull();
  });

  it("returns pending update metadata", async () => {
    checkMock.mockResolvedValue({
      version: "0.2.0",
      body: "新功能",
    });

    const result = await checkForAppUpdateOnceAtStartup();
    expect(result).toEqual({
      version: "0.2.0",
      notes: "新功能",
      currentVersion: "0.1.0",
      update: expect.objectContaining({ version: "0.2.0" }),
    });
  });

  it("silently skips offline errors", async () => {
    checkMock.mockRejectedValue(new Error("network error"));

    const result = await checkForAppUpdateOnceAtStartup();
    expect(result).toBeNull();
  });

  it("tracks skipped version in localStorage", () => {
    markUpdateSkipped("1.0.0");
    expect(isUpdateSkipped("1.0.0")).toBe(true);
    expect(isUpdateSkipped("1.0.1")).toBe(false);
  });

  it("clears startup check flag for tests/dev reload", () => {
    sessionStorage.setItem("canvasflow-updater-startup-checked", "1");
    clearStartupUpdateCheckFlag();
    expect(sessionStorage.getItem("canvasflow-updater-startup-checked")).toBeNull();
  });
});
