import { describe, expect, it } from "vitest";
import {
  normalizeVideoJobProgress,
  resolveVideoGenerationProgressPercent,
} from "./normalizeVideoJobProgress";

describe("normalizeVideoJobProgress", () => {
  it("scales 0~1 fractions to percent", () => {
    expect(normalizeVideoJobProgress(0.25)).toBe(25);
    expect(normalizeVideoJobProgress(0.5)).toBe(50);
    expect(normalizeVideoJobProgress(0.75)).toBe(75);
  });

  it("keeps 0~100 values", () => {
    expect(normalizeVideoJobProgress(42)).toBe(42);
  });
});

describe("resolveVideoGenerationProgressPercent", () => {
  it("prefers the larger normalized value", () => {
    expect(resolveVideoGenerationProgressPercent(0.2, 35)).toBe(35);
    expect(resolveVideoGenerationProgressPercent(0.8, 12)).toBe(80);
  });
});
