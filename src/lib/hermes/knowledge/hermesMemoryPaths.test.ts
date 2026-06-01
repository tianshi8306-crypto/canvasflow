import { describe, expect, it } from "vitest";
import {
  formatHermesMemoryMigrationNotice,
  hermesMemoryRootsEqual,
  normalizeHermesMemoryRoot,
} from "@/lib/hermes/knowledge/hermesMemoryPaths";

describe("hermesMemoryPaths", () => {
  it("normalizes empty roots to null", () => {
    expect(normalizeHermesMemoryRoot(null)).toBeNull();
    expect(normalizeHermesMemoryRoot("  ")).toBeNull();
    expect(normalizeHermesMemoryRoot(" D:\\Mem ")).toBe("D:\\Mem");
  });

  it("compares roots after normalization", () => {
    expect(hermesMemoryRootsEqual(null, "")).toBe(true);
    expect(hermesMemoryRootsEqual("D:\\A", " D:\\A ")).toBe(true);
    expect(hermesMemoryRootsEqual("D:\\A", "D:\\B")).toBe(false);
  });

  it("formats migration notice", () => {
    expect(
      formatHermesMemoryMigrationNotice({
        migratedFiles: 2,
        skippedFiles: 0,
        conflictFiles: 0,
        fromDir: "a",
        toDir: "b",
      }),
    ).toContain("已迁移 2 条经验");
    expect(
      formatHermesMemoryMigrationNotice({
        migratedFiles: 0,
        skippedFiles: 0,
        conflictFiles: 0,
        fromDir: "a",
        toDir: "b",
      }),
    ).toBeNull();
  });
});
