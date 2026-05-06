import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { persistVideoGenerationMode, resolveVideoGenerationMode } from "./mode";

const STORAGE_KEY = "videoGeneration.mode.v1";

const { mockIsTauri } = vi.hoisted(() => ({
  mockIsTauri: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", async () => {
  const actual = await vi.importActual<typeof import("@tauri-apps/api/core")>("@tauri-apps/api/core");
  return { ...actual, isTauri: mockIsTauri };
});

function makeStorage() {
  const store: Record<string, string> = {};
  const localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  } as unknown as Storage;
  return { store, localStorage };
}

function stubWindow() {
  const { localStorage } = makeStorage();
  vi.stubGlobal("window", { localStorage });
}

function stubEnv(value: string | undefined) {
  // Directly set the property since import.meta.env is a regular JS object in Vite
  (import.meta.env as Record<string, unknown>).VITE_VIDEO_GENERATION_MODE = value;
}

describe("resolveVideoGenerationMode", () => {
  beforeEach(() => {
    mockIsTauri.mockReset();
    mockIsTauri.mockReturnValue(false);
    stubEnv(undefined);
    stubWindow();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 'bridge' from env when VITE_VIDEO_GENERATION_MODE=bridge", () => {
    stubEnv("bridge");
    expect(resolveVideoGenerationMode()).toBe("bridge");
  });

  it("returns 'mock' from env when VITE_VIDEO_GENERATION_MODE=mock", () => {
    stubEnv("mock");
    expect(resolveVideoGenerationMode()).toBe("mock");
  });

  it("returns 'auto' from env when VITE_VIDEO_GENERATION_MODE=auto", () => {
    stubEnv("auto");
    expect(resolveVideoGenerationMode()).toBe("auto");
  });

  it("ignores env if value is not a valid mode", () => {
    stubEnv("not_a_valid_mode");
    window.localStorage.setItem(STORAGE_KEY, "mock");
    expect(resolveVideoGenerationMode()).toBe("mock");
  });

  it("returns storage value when env is absent and storage has 'auto'", () => {
    window.localStorage.setItem(STORAGE_KEY, "auto");
    expect(resolveVideoGenerationMode()).toBe("auto");
  });

  it("returns storage value when env is absent and storage has 'bridge'", () => {
    window.localStorage.setItem(STORAGE_KEY, "bridge");
    expect(resolveVideoGenerationMode()).toBe("bridge");
  });

  it("falls back to 'bridge' when isTauri=true and no env/storage", () => {
    mockIsTauri.mockReturnValue(true);
    expect(resolveVideoGenerationMode()).toBe("bridge");
  });

  it("falls back to 'mock' when isTauri=false and no env/storage", () => {
    mockIsTauri.mockReturnValue(false);
    expect(resolveVideoGenerationMode()).toBe("mock");
  });

  it("trims whitespace from env value", () => {
    stubEnv("  mock  ");
    expect(resolveVideoGenerationMode()).toBe("mock");
  });

  it("trims whitespace from storage value", () => {
    window.localStorage.setItem(STORAGE_KEY, "  bridge  ");
    expect(resolveVideoGenerationMode()).toBe("bridge");
  });

  it("ignores case when parsing env value", () => {
    stubEnv("BRIDGE");
    expect(resolveVideoGenerationMode()).toBe("bridge");
  });

  it("falls back to default when storage contains invalid value", () => {
    mockIsTauri.mockReturnValue(true);
    window.localStorage.setItem(STORAGE_KEY, "not_valid");
    expect(resolveVideoGenerationMode()).toBe("bridge");
  });
});

describe("persistVideoGenerationMode", () => {
  beforeEach(() => {
    stubWindow();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores the given mode in localStorage", () => {
    persistVideoGenerationMode("bridge");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("bridge");
  });

  it("stores 'auto' mode correctly", () => {
    persistVideoGenerationMode("auto");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("auto");
  });

  it("overwrites previous value", () => {
    persistVideoGenerationMode("mock");
    persistVideoGenerationMode("bridge");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("bridge");
  });
});