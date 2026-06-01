import { describe, expect, it } from "vitest";
import {
  imageRefPathsFromAssets,
  mentionNameFromRelPath,
  parseHermesMentions,
  resolveHermesMentions,
  type HermesRefAsset,
} from "@/lib/hermes/hermesRefAssets";

const pinned: HermesRefAsset[] = [
  {
    pinId: "p1",
    assetId: "a1",
    relPath: "assets/neon-street.png",
    mentionName: "霓虹街景",
    mediaType: "image",
    pinnedAt: 1,
  },
];

describe("hermesRefAssets", () => {
  it("mentionNameFromRelPath strips extension", () => {
    expect(mentionNameFromRelPath("assets/foo.bar.png")).toBe("foo.bar");
  });

  it("parseHermesMentions finds tokens", () => {
    expect(parseHermesMentions("参考 @霓虹街景 的色调")).toEqual(["霓虹街景"]);
  });

  it("resolveHermesMentions matches pinned assets", () => {
    const hits = resolveHermesMentions("按 @霓虹街景 出图", pinned);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.relPath).toBe("assets/neon-street.png");
  });

  it("imageRefPathsFromAssets filters images only", () => {
    const paths = imageRefPathsFromAssets([
      ...pinned,
      {
        pinId: "p2",
        assetId: "a2",
        relPath: "assets/voice.mp3",
        mentionName: "旁白",
        mediaType: "audio",
        pinnedAt: 2,
      },
    ]);
    expect(paths).toEqual(["assets/neon-street.png"]);
  });
});
