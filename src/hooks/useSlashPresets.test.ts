// src/hooks/useSlashPresets.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSlashPresets } from "./useSlashPresets";

const PRESETS_KEY = "canvasflow.slashPresets.v1";
const USAGE_KEY = "canvasflow.slashPresetUsage.v1";

const cleanStorage = () => {
  localStorage.removeItem(PRESETS_KEY);
  localStorage.removeItem(USAGE_KEY);
};

describe("useSlashPresets", () => {
  beforeEach(() => cleanStorage());

  it("returns built-in presets when no custom presets exist", () => {
    const { result } = renderHook(() => useSlashPresets());
    expect(result.current.presets.length).toBeGreaterThan(0);
    expect(result.current.presets.every((p) => !p.isCustom)).toBe(true);
  });

  it("adds custom preset to the list", () => {
    const { result } = renderHook(() => useSlashPresets());
    const id = result.current.addCustomPreset({
      title: "我的预设", desc: "测试", icon: "🧪",
      template: "测试模板", category: "通用",
    });
    const { result: result2 } = renderHook(() => useSlashPresets());
    expect(result2.current.presets.some((p) => p.id === id)).toBe(true);
  });

  it("removes custom preset", () => {
    const { result } = renderHook(() => useSlashPresets());
    const id = result.current.addCustomPreset({
      title: "删除我", desc: "", icon: "🗑️", template: "x", category: "通用",
    });
    result.current.removeCustomPreset(id);
    const { result: result2 } = renderHook(() => useSlashPresets());
    expect(result2.current.presets.every((p) => p.id !== id)).toBe(true);
  });

  it("sorts presets by usageCount desc", () => {
    // Directly set localStorage to simulate recorded usage
    localStorage.setItem("canvasflow.slashPresetUsage.v1", JSON.stringify({
      "builtin-person-3view": 5,
      "builtin-person-3view-face": 1,
    }));
    const { result } = renderHook(() => useSlashPresets());
    const idx3view = result.current.presets.findIndex((p) => p.id === "builtin-person-3view");
    const idx3viewFace = result.current.presets.findIndex((p) => p.id === "builtin-person-3view-face");
    expect(idx3view).not.toBe(-1);
    expect(idx3viewFace).not.toBe(-1);
    expect(idx3view).toBeLessThan(idx3viewFace);
  });
});