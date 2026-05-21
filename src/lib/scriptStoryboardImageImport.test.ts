import { describe, expect, it } from "vitest";
import { patchStoryboardShotImage } from "@/lib/scriptStoryboardImageImport";

describe("scriptStoryboardImageImport", () => {
  it("appends shot row when missing", () => {
    const next = patchStoryboardShotImage(undefined, "b1", { imagePath: "assets/a.png" });
    expect(next).toHaveLength(1);
    expect(next[0]?.scriptBeatId).toBe("b1");
    expect(next[0]?.imagePath).toBe("assets/a.png");
  });

  it("patches existing shot", () => {
    const next = patchStoryboardShotImage(
      [{ scriptBeatId: "b1", visualPrompt: "hello", imagePath: "old.png" }],
      "b1",
      { imagePath: "assets/new.png" },
    );
    expect(next[0]?.imagePath).toBe("assets/new.png");
    expect(next[0]?.visualPrompt).toBe("hello");
  });
});
