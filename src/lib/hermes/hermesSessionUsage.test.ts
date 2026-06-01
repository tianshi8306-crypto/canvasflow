import { describe, expect, it } from "vitest";
import {
  addHermesSessionTokens,
  estimateTokensFromText,
  formatTokenEstimate,
  getHermesSessionTokens,
} from "@/lib/hermes/hermesSessionUsage";

describe("hermesSessionUsage", () => {
  it("estimates tokens from text length", () => {
    expect(estimateTokensFromText("hello")).toBeGreaterThan(0);
  });

  it("accumulates per project", () => {
    const path = `/tmp/hermes-usage-${Date.now()}`;
    addHermesSessionTokens(path, 100);
    addHermesSessionTokens(path, 50);
    expect(getHermesSessionTokens(path)).toBe(150);
  });

  it("formats token counts", () => {
    expect(formatTokenEstimate(500)).toBe("500");
    expect(formatTokenEstimate(2500)).toBe("2.5k");
  });
});
