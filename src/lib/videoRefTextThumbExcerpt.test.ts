import { describe, expect, it } from "vitest";
import { videoRefTextThumbExcerpt } from "./videoRefTextThumbExcerpt";

describe("videoRefTextThumbExcerpt", () => {
  it("trims and normalizes line endings", () => {
    expect(videoRefTextThumbExcerpt("  hello\r\nworld  ")).toBe("hello\nworld");
  });

  it("returns empty for blank input", () => {
    expect(videoRefTextThumbExcerpt("   ")).toBe("");
    expect(videoRefTextThumbExcerpt(undefined)).toBe("");
  });

  it("truncates long text with ellipsis", () => {
    const long = "a".repeat(500);
    const out = videoRefTextThumbExcerpt(long, 100);
    expect(out).toHaveLength(101);
    expect(out.endsWith("…")).toBe(true);
  });
});
