import { describe, it, expect } from "vitest";
import {
  BGM_PRESETS,
  BGM_CATEGORIES,
  getPresetsByCategory,
  getPresetById,
  searchPresetsByTag,
} from "@/lib/bgm/bgmLibrary";

describe("bgmLibrary", () => {
  it("has preset entries", () => {
    expect(BGM_PRESETS.length).toBeGreaterThan(0);
  });

  it("all presets have required fields", () => {
    for (const p of BGM_PRESETS) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(p.tags.length).toBeGreaterThan(0);
      expect(p.category).toBeTruthy();
    }
  });

  it("all presets belong to known categories", () => {
    const catIds = new Set(BGM_CATEGORIES.map((c) => c.id));
    for (const p of BGM_PRESETS) {
      expect(catIds.has(p.category), `unknown category: ${p.category}`).toBe(true);
    }
  });

  it("categories have labels", () => {
    for (const cat of BGM_CATEGORIES) {
      expect(cat.id).toBeTruthy();
      expect(cat.label).toBeTruthy();
    }
  });

  it("getPresetsByCategory filters correctly", () => {
    for (const cat of BGM_CATEGORIES) {
      const presets = getPresetsByCategory(cat.id);
      expect(presets.length).toBeGreaterThan(0);
      for (const p of presets) {
        expect(p.category).toBe(cat.id);
      }
    }
  });

  it("getPresetById finds existing preset", () => {
    const first = BGM_PRESETS[0]!;
    const found = getPresetById(first.id);
    expect(found).toBeDefined();
    expect(found!.name).toBe(first.name);
  });

  it("getPresetById returns undefined for unknown id", () => {
    expect(getPresetById("nonexistent")).toBeUndefined();
  });

  it("searchPresetsByTag finds by name", () => {
    const results = searchPresetsByTag("钢琴");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((p) => p.id === "cinematic_piano" || p.name.includes("钢琴"))).toBe(true);
  });

  it("searchPresetsByTag finds by tag", () => {
    const results = searchPresetsByTag("旅行");
    expect(results.length).toBeGreaterThan(0);
  });

  it("searchPresetsByTag is case-insensitive", () => {
    const lower = searchPresetsByTag("vlog");
    const upper = searchPresetsByTag("VLOG");
    expect(lower.length).toBe(upper.length);
  });

  it("searchPresetsByTag returns empty for nonsense query", () => {
    expect(searchPresetsByTag("xyznonexistent999")).toEqual([]);
  });
});
