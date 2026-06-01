import { describe, expect, it } from "vitest";
import {
  assetMediaKind,
  assetStorageCategory,
  groupAssetsForGallery,
  sortAssetsForGallery,
} from "./canvasAssets";

describe("canvasAssets", () => {
  it("classifies type-first and legacy paths", () => {
    expect(assetStorageCategory("assets/video/gen/dreamina/foo.mp4")).toBe("gen");
    expect(assetStorageCategory("assets/image/import/hero.png")).toBe("import");
    expect(assetStorageCategory("assets/exports/timeline.mp4")).toBe("export");
    expect(assetStorageCategory("assets/gen/video/dreamina/old.mp4")).toBe("legacy");
    expect(assetStorageCategory("assets/dreamina_vid_old.mp4")).toBe("legacy");
    expect(assetMediaKind("assets/video/import/a.mp4")).toBe("video");
  });

  it("sorts by media type then path", () => {
    const sorted = sortAssetsForGallery([
      { relPath: "assets/video/import/b.mp4", mediaType: "video" },
      { relPath: "assets/image/import/a.png", mediaType: "image" },
      { relPath: "assets/video/gen/a.mp4", mediaType: "video" },
    ]);
    expect(sorted.map((a) => a.relPath)).toEqual([
      "assets/image/import/a.png",
      "assets/video/gen/a.mp4",
      "assets/video/import/b.mp4",
    ]);
  });

  it("groups assets by storage category", () => {
    const groups = groupAssetsForGallery([
      { relPath: "assets/old.mp4", mediaType: "video" },
      { relPath: "assets/video/gen/tools/tools_trim_20260529_x.mp4", mediaType: "video" },
      { relPath: "assets/image/import/ref.png", mediaType: "image" },
    ]);
    expect(groups.map((g) => g.category)).toEqual(["gen", "import", "legacy"]);
  });
});
