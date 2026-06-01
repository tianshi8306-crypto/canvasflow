import { describe, expect, it } from "vitest";
import {
  buildNamedAssetsForVideoGeneration,
  buildVideoNamedAssetsFromIncoming,
  buildVideoRefAtMeta,
  enrichVideoPromptSegmentsWithMedia,
  findEdgeIdForPromptSegment,
  parseVideoPromptInlineSegments,
  preferredVideoNameToken,
  normalizeVideoPromptRefTokens,
  resolveCanonicalVideoRefInsertToken,
  videoRefAtCandidates,
  videoRefPickerItems,
} from "./videoPromptAtTokens";
import { findAssetByName, parseAtReferences } from "./promptBuilder";
import type { FlowNodeData } from "@/lib/types";
import type { Edge, Node } from "@xyflow/react";
import type { VideoGenerationDraft } from "@/lib/videoNodeTypes";
import type { VideoIncomingRefItem } from "@/hooks/useVideoIncomingReferenceItems";
import { buildPanelOrderedRefs } from "./videoPromptAtTokens";
import { buildSeedancePromptSimple } from "./promptBuilder";

const items: VideoIncomingRefItem[] = [
  { kind: "image", path: "assets/hero.png", y: 0, edgeId: "e1", sourceNodeId: "i1", nodeLabel: "hero" },
  { kind: "audio", path: "assets/背景音乐.mp3", y: 1, edgeId: "e2", sourceNodeId: "a1", nodeLabel: "背景音乐" },
  { kind: "image", path: "assets/bg.png", y: 2, edgeId: "e3", sourceNodeId: "i2", nodeLabel: "bg" },
];

describe("videoPromptAtTokens", () => {
  it("assigns panel-order slot tokens (图片/声音/视频 + 序号)", () => {
    const meta = buildVideoRefAtMeta(items);
    expect(meta.get("e1")).toMatchObject({
      token: "@图片1",
      badge: "1",
      namedToken: "@hero.png",
      stemToken: "@hero",
    });
    expect(meta.get("e2")).toMatchObject({
      token: "@声音2",
      badge: "2",
      stemToken: "@背景音乐",
      namedToken: "@背景音乐.mp3",
    });
    expect(meta.get("e3")).toMatchObject({
      token: "@图片3",
      badge: "3",
    });
  });

  it("uses node label when distinct from file stem", () => {
    const labels = new Map([["e1", "主角立绘"]]);
    const meta = buildVideoRefAtMeta(items, labels);
    expect(meta.get("e1")?.displayToken).toBe("@主角立绘");
    expect(preferredVideoNameToken(meta.get("e1")!)).toBe("@主角立绘");
  });

  it("prefers stem when label equals stem", () => {
    const labels = new Map([["e2", "背景音乐"]]);
    const meta = buildVideoRefAtMeta(items, labels);
    expect(meta.get("e2")?.displayToken).toBeUndefined();
    expect(preferredVideoNameToken(meta.get("e2")!)).toBe("@背景音乐");
  });

  it("lists indexed and name rows in dropdown", () => {
    const labels = new Map([["e2", "背景音乐"]]);
    const rows = videoRefAtCandidates(items, labels);
    expect(rows.some((r) => r.insertToken === "@背景音乐")).toBe(true);
    expect(rows.some((r) => r.insertToken === "@图片1")).toBe(true);
  });

  it("videoRefPickerItems uses LibTV-style menu labels", () => {
    const rows = videoRefPickerItems(items);
    expect(rows[0]?.menuTitle).toBe("图片 1");
    expect(rows[0]?.menuShortcut).toBe("(@1)");
    expect(rows[0]?.insertToken).toBe("@图片1");
    expect(rows[1]?.insertToken).toBe("@声音2");
  });

  it("parses @背景音乐 with wired named assets", () => {
    const named = buildVideoNamedAssetsFromIncoming(items);
    const segs = parseVideoPromptInlineSegments("参考 @背景音乐 的节奏", named);
    expect(segs.some((s) => s.kind === "atNamed" && s.label === "背景音乐")).toBe(true);
  });

  it("parses {{Portrait N}} and {{mixed N}} as image chips", () => {
    const segs = parseVideoPromptInlineSegments(
      "角色 {{Portrait 4}} 与 {{mixed 5}}",
      buildVideoNamedAssetsFromIncoming(items),
    );
    const refs = segs.filter((s) => s.kind === "atRef");
    expect(refs).toHaveLength(2);
    expect(refs[0]).toMatchObject({ refKind: "image", index: 4, label: "图片4" });
    expect(refs[1]).toMatchObject({ refKind: "image", index: 5, label: "图片5" });
  });

  it("enriches brace tokens with media by panel slot", () => {
    const segs = parseVideoPromptInlineSegments("参考 {{Portrait 1}}", buildVideoNamedAssetsFromIncoming(items));
    const enriched = enrichVideoPromptSegmentsWithMedia(segs, items);
    expect(enriched.find((s) => s.kind === "atRef")).toMatchObject({
      edgeId: "e1",
      path: "assets/hero.png",
    });
  });

  it("buildVideoNamedAssetsFromIncoming adds stem alias", () => {
    const named = buildVideoNamedAssetsFromIncoming(items);
    const audio = named.find((n) => n.kind === "audio");
    expect(audio?.aliases).toContain("背景音乐");
  });
});

describe("buildNamedAssetsForVideoGeneration", () => {
  it("merges upstream node label and beat shot number as aliases", () => {
    const nodes = [
      {
        id: "script1",
        type: "scriptNode",
        position: { x: 0, y: 0 },
        data: {
          label: "脚本",
          scriptBeats: [{ id: "b1", shotNumber: "S03", description: "x" }],
        },
      },
      {
        id: "img1",
        type: "imageNode",
        position: { x: 0, y: 0 },
        data: { label: "主角立绘", path: "assets/hero.png", params: { scriptBeatId: "b1" } },
      },
      {
        id: "vid1",
        type: "videoNode",
        position: { x: 0, y: 100 },
        data: {
          label: "视频",
          path: "",
          params: { scriptBeatId: "b1" },
        },
      },
    ] as Node<FlowNodeData>[];
    const edges: Edge[] = [
      { id: "e1", source: "script1", target: "img1" },
      { id: "e2", source: "img1", target: "vid1" },
    ];
    const named = buildNamedAssetsForVideoGeneration({
      videoNodeId: "vid1",
      draft: {
        referenceImagePaths: ["assets/hero.png"],
        referenceVideoPaths: [],
        referenceAudioPaths: [],
      } as Pick<VideoGenerationDraft, "referenceImagePaths" | "referenceVideoPaths" | "referenceAudioPaths">,
      nodes,
      edges,
    });
    expect(findAssetByName("主角立绘", named)?.path).toBe("assets/hero.png");
    expect(findAssetByName("S03", named)?.path).toBe("assets/hero.png");
    expect(parseAtReferences("参考 @主角立绘", named)[0]?.kind).toBe("image");
  });

  it("enrichVideoPromptSegmentsWithMedia binds edgeId for @图片1", () => {
    const segs = parseVideoPromptInlineSegments(
      "参考 @图片1 的动作",
      buildVideoNamedAssetsFromIncoming(items),
    );
    const enriched = enrichVideoPromptSegmentsWithMedia(segs, items);
    const pill = enriched.find((s) => s.kind === "atRef");
    expect(pill).toMatchObject({
      edgeId: "e1",
      path: "assets/hero.png",
      mediaKind: "image",
    });
  });

  it("findEdgeIdForPromptSegment resolves named @stem", () => {
    const segs = parseVideoPromptInlineSegments(
      "参考 @背景音乐 的节奏",
      buildVideoNamedAssetsFromIncoming(items),
    );
    const named = segs.find((s) => s.kind === "atNamed");
    expect(named?.kind).toBe("atNamed");
    if (named?.kind === "atNamed") {
      expect(findEdgeIdForPromptSegment(named, items)).toBe("e2");
    }
  });
});

describe("panel-order @ tokens in buildSeedancePromptSimple", () => {
  it("resolves @图片N / @声音N by reference strip slot", () => {
    const panelItems: VideoIncomingRefItem[] = [
      { kind: "image", path: "assets/a.png", y: 0, edgeId: "e1", sourceNodeId: "i1", nodeLabel: "a" },
      { kind: "image", path: "assets/b.png", y: 1, edgeId: "e2", sourceNodeId: "i2", nodeLabel: "b" },
      { kind: "video", path: "assets/v.mp4", y: 2, edgeId: "e3", sourceNodeId: "v1", nodeLabel: "v" },
    ];
    const panelOrder = buildPanelOrderedRefs(panelItems);
    const result = buildSeedancePromptSimple(
      "参考 @图片2 与 @视频3",
      ["assets/a.png", "assets/b.png"],
      ["assets/v.mp4"],
      [],
      undefined,
      panelOrder,
    );
    expect(result.imagePaths).toEqual(["assets/b.png"]);
    expect(result.videoPaths).toEqual(["assets/v.mp4"]);
  });
});

describe("resolveCanonicalVideoRefInsertToken", () => {
  it("maps filename alias to @图片N", () => {
    expect(
      resolveCanonicalVideoRefInsertToken("@hero.png", items, undefined),
    ).toBe("@图片1");
  });

  it("keeps unknown tokens unchanged", () => {
    expect(resolveCanonicalVideoRefInsertToken("@unknown", items)).toBe("@unknown");
  });
});

describe("normalizeVideoPromptRefTokens", () => {
  it("rewrites @filename to canonical slot token on blur path", () => {
    const next = normalizeVideoPromptRefTokens("参考 @bg.png 的色调", items);
    expect(next).toBe("参考 @图片3 的色调");
  });

  it("preserves {{Portrait N}} brace tokens", () => {
    const next = normalizeVideoPromptRefTokens(
      "角色 {{Portrait 1}} 与 @hero.png",
      items,
    );
    expect(next).toContain("{{Portrait 1}}");
    expect(next).toContain("@图片1");
    expect(next).not.toContain("@hero.png");
  });
});

describe("buildSeedancePromptSimple named refs", () => {
  it("resolves @filename to correct path only", () => {
    const named = buildVideoNamedAssetsFromIncoming([
      { kind: "image", path: "assets/a.png", y: 0, edgeId: "e1", sourceNodeId: "n1", nodeLabel: "A" },
      { kind: "image", path: "assets/b.png", y: 1, edgeId: "e2", sourceNodeId: "n2", nodeLabel: "B" },
    ]);
    const result = buildSeedancePromptSimple(
      "模仿 @b.png 的构图",
      ["assets/a.png", "assets/b.png"],
      [],
      [],
      named,
    );
    expect(result.imagePaths).toEqual(["assets/b.png"]);
  });
});
