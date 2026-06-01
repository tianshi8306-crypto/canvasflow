import { describe, expect, it } from "vitest";
import {
  buildSeedancePromptSimple,
  findAssetByName,
  parseAtReferences,
} from "./promptBuilder";
import { buildVideoNamedAssetsFromPaths } from "./videoPromptAtTokens";

describe("buildSeedancePromptSimple", () => {
  it("returns all paths when prompt has no indexed @ refs", () => {
    const result = buildSeedancePromptSimple("一只猫在跑步", ["a.png", "b.png"], ["v.mp4"], []);
    expect(result.imagePaths).toEqual(["a.png", "b.png"]);
    expect(result.videoPaths).toEqual(["v.mp4"]);
    expect(result.expandedPrompt).toBe("一只猫在跑步");
  });

  it("legacy @图N still resolves by per-kind index", () => {
    const named = buildVideoNamedAssetsFromPaths(
      ["a.png", "b.png"],
      ["v1.mp4", "v2.mp4"],
      ["x.mp3"],
    );
    const result = buildSeedancePromptSimple(
      "参考 @图2 的动作，@视频1 的运镜",
      ["a.png", "b.png"],
      ["v1.mp4", "v2.mp4"],
      ["x.mp3"],
      named,
    );
    expect(result.imagePaths).toEqual(["b.png"]);
    expect(result.videoPaths).toEqual(["v1.mp4"]);
    expect(result.audioPaths).toEqual([]);
  });

  it("parseAtReferences picks up @图片1", () => {
    const refs = parseAtReferences("让 @图片1 的人物动起来");
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ kind: "image", index: 1 });
  });

  it("parseAtReferences picks up LibTV brace tokens {{Portrait N}} / {{mixed N}}", () => {
    const refs = parseAtReferences("角色 {{Portrait 4}} 与场景 {{mixed 5}}");
    expect(refs).toHaveLength(2);
    expect(refs[0]).toMatchObject({
      kind: "image",
      index: 4,
      fullMatch: "{{Portrait 4}}",
    });
    expect(refs[1]).toMatchObject({
      kind: "image",
      index: 5,
      fullMatch: "{{mixed 5}}",
    });
  });

  it("buildSeedancePromptSimple resolves {{Portrait 2}} by panel order", () => {
    const panelItems = [
      { slot: 1, kind: "image" as const, path: "assets/a.png" },
      { slot: 2, kind: "image" as const, path: "assets/b.png" },
    ];
    const result = buildSeedancePromptSimple(
      "参考 {{Portrait 2}} 的构图",
      ["assets/a.png", "assets/b.png"],
      [],
      [],
      undefined,
      panelItems,
    );
    expect(result.imagePaths).toEqual(["assets/b.png"]);
  });

  it("merges indexed and named refs in one prompt", () => {
    const named = buildVideoNamedAssetsFromPaths(["a.png", "b.png"], ["v.mp4"], []);
    const result = buildSeedancePromptSimple(
      "@图1 与 @b.png",
      ["a.png", "b.png"],
      ["v.mp4"],
      [],
      named,
    );
    expect(result.imagePaths).toEqual(["a.png", "b.png"]);
    expect(result.videoPaths).toEqual([]);
  });
});

describe("findAssetByName / parseAtReferences wired assets", () => {
  const wired = [
    {
      name: "背景音乐.mp3",
      path: "assets/背景音乐.mp3",
      kind: "audio" as const,
      aliases: ["背景音乐"],
    },
    {
      name: "hero.png",
      path: "assets/hero.png",
      kind: "image" as const,
      aliases: ["hero"],
    },
  ];

  it("matches stem without extension via aliases", () => {
    expect(findAssetByName("背景音乐", wired)?.path).toBe("assets/背景音乐.mp3");
  });

  it("parses @背景音乐 when namedAssets provided", () => {
    const refs = parseAtReferences("配乐使用 @背景音乐", wired);
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ kind: "audio", name: "背景音乐" });
  });

  it("buildSeedancePromptSimple resolves @背景音乐 to audio path only", () => {
    const result = buildSeedancePromptSimple(
      "参考 @背景音乐 的节奏",
      ["assets/hero.png"],
      [],
      ["assets/背景音乐.mp3", "assets/other.mp3"],
      wired,
    );
    expect(result.audioPaths).toEqual(["assets/背景音乐.mp3"]);
    expect(result.imagePaths).toEqual([]);
  });

  it("matches source node label alias", () => {
    const withLabel = [
      {
        name: "clip_01.mp4",
        path: "assets/clip_01.mp4",
        kind: "video" as const,
        aliases: ["clip_01", "主角走位"],
      },
    ];
    expect(findAssetByName("主角走位", withLabel)?.path).toBe("assets/clip_01.mp4");
    const refs = parseAtReferences("参考 @主角走位", withLabel);
    expect(refs[0]?.kind).toBe("video");
  });
});
