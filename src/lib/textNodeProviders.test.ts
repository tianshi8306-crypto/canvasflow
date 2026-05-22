import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getProviderSelectionPatch,
  loadEnabledProviderOptions,
  toEnabledProviderOptions,
  type TextNodeProviderOption,
} from "./textNodeProviders";

const { mockInvoke, mockIsTauri } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockIsTauri: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
  isTauri: mockIsTauri,
}));

describe("textNodeProviders", () => {
  const providers: TextNodeProviderOption[] = [
    { id: "p2", label: "P2", model: "m2", enabled: true, priority: 20 },
    { id: "p1", label: "P1", model: "m1", enabled: true, priority: 10 },
    { id: "p3", label: "P3", model: "m3", enabled: false, priority: 1 },
  ];

  beforeEach(() => {
    mockInvoke.mockReset();
    mockIsTauri.mockReset();
  });

  it("toEnabledProviderOptions filters disabled and sorts by priority", () => {
    const result = toEnabledProviderOptions(providers);
    expect(result.map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("loadEnabledProviderOptions returns empty when not tauri", async () => {
    mockIsTauri.mockReturnValue(false);
    const result = await loadEnabledProviderOptions();
    expect(result).toEqual([]);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("loadEnabledProviderOptions loads and normalizes provider list", async () => {
    mockIsTauri.mockReturnValue(true);
    mockInvoke.mockResolvedValue({ providers });
    const result = await loadEnabledProviderOptions();
    expect(mockInvoke).toHaveBeenCalledWith("load_settings");
    expect(result.map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("loadEnabledProviderOptions returns empty when invoke fails", async () => {
    mockIsTauri.mockReturnValue(true);
    mockInvoke.mockRejectedValue(new Error("boom"));
    await expect(loadEnabledProviderOptions()).resolves.toEqual([]);
  });

  it("getProviderSelectionPatch clears fields for empty provider", () => {
    expect(getProviderSelectionPatch("", providers)).toEqual({
      providerId: undefined,
      model: undefined,
    });
  });

  it("getProviderSelectionPatch returns chosen model when provider exists", () => {
    expect(getProviderSelectionPatch("p1", providers)).toEqual({
      providerId: "p1",
      model: "m1",
    });
  });

  it("getProviderSelectionPatch omits model when provider missing", () => {
    expect(getProviderSelectionPatch("missing", providers)).toEqual({
      providerId: "missing",
    });
  });
});
