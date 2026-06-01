import { describe, expect, it } from "vitest";
import { parseImageGenerationRelPaths } from "./parseImageGenerationResult";

describe("parseImageGenerationRelPaths", () => {
  it("parses single relative path", () => {
    expect(parseImageGenerationRelPaths("assets/a.png")).toEqual(["assets/a.png"]);
  });

  it("parses JSON array from multi-count API", () => {
    const raw = JSON.stringify(["assets/a.png", "assets/b.png"]);
    expect(parseImageGenerationRelPaths(raw)).toEqual(["assets/a.png", "assets/b.png"]);
  });

  it("returns empty for blank", () => {
    expect(parseImageGenerationRelPaths("  ")).toEqual([]);
  });
});
