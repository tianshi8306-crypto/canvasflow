import { describe, expect, it } from "vitest";
import { normalizeAppTheme } from "./appTheme";

describe("normalizeAppTheme", () => {
  it("keeps dark", () => {
    expect(normalizeAppTheme("dark")).toBe("dark");
  });

  it("maps legacy presets to light", () => {
    expect(normalizeAppTheme("day")).toBe("light");
    expect(normalizeAppTheme("dawn")).toBe("light");
    expect(normalizeAppTheme("dusk")).toBe("light");
  });

  it("defaults to dark", () => {
    expect(normalizeAppTheme(undefined)).toBe("dark");
    expect(normalizeAppTheme("")).toBe("dark");
  });
});
