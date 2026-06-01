import { describe, it, expect } from "vitest";
import {
  buildImageRefAtMeta,
  imageRefAtToken,
  imageRefPickerItems,
  normalizeImagePromptRefTokens,
  parseImagePromptInlineSegments,
  remapImagePromptRefOrder,
  resolveCanonicalImageRefInsertToken,
} from "./imagePromptAtTokens";
import type { ResolvedIncomingImageRef } from "./types";

const refs: ResolvedIncomingImageRef[] = [
  {
    kind: "image",
    edgeId: "e1",
    sourceNodeId: "n1",
    nodeLabel: "图片1",
    path: "assets/a.png",
    resolvedPath: "/proj/assets/a.png",
    y: 0,
  },
  {
    kind: "image",
    edgeId: "e2",
    sourceNodeId: "n2",
    nodeLabel: "图片2",
    path: "assets/b.png",
    resolvedPath: "/proj/assets/b.png",
    y: 1,
  },
];

describe("imagePromptAtTokens", () => {
  it("builds @图片N tokens aligned with ref strip order", () => {
    const meta = buildImageRefAtMeta(refs, { n1: "角色A", n2: "角色B" });
    expect(meta.get("n1")?.token).toBe("@图片1");
    expect(meta.get("n2")?.token).toBe("@图片2");
    expect(meta.get("n1")?.label).toBe("图片1");
    expect(meta.get("n1")?.badge).toBe("1");
    expect(meta.get("n2")?.badge).toBe("2");
  });

  it("picker items use canonical insert token", () => {
    const items = imageRefPickerItems(refs);
    expect(items).toHaveLength(2);
    expect(items[0]?.insertToken).toBe("@图片1");
    expect(items[1]?.insertToken).toBe("@图片2");
  });

  it("parses @图片N and style tokens together", () => {
    const segs = parseImagePromptInlineSegments("参考 @图片1 #[style:cinematic] 色调", refs);
    expect(segs.some((s) => s.kind === "atRef" && s.token === "@图片1")).toBe(true);
    expect(segs.some((s) => s.kind === "style" && s.styleId === "cinematic")).toBe(true);
  });

  it("normalizes legacy @图N to @图片N", () => {
    expect(normalizeImagePromptRefTokens("参考 @图2 动作", refs)).toBe("参考 @图片2 动作");
  });

  it("resolves @[nodeId] to @图片N", () => {
    expect(resolveCanonicalImageRefInsertToken("@[n2]", refs)).toBe("@图片2");
  });

  it("maps filename alias to @图片N on normalize", () => {
    expect(normalizeImagePromptRefTokens("参考 @b.png 的构图", refs)).toBe("参考 @图片2 的构图");
  });

  it("remapImagePromptRefOrder updates slot tokens after reorder", () => {
    const before = refs;
    const after: ResolvedIncomingImageRef[] = [refs[1]!, refs[0]!];
    const prompt = "参考 @图片1 与 @图片2";
    expect(remapImagePromptRefOrder(prompt, before, after)).toBe("参考 @图片2 与 @图片1");
  });
});

describe("imageRefAtToken", () => {
  it("formats slot token with 图片 prefix for pill width", () => {
    expect(imageRefAtToken(3)).toBe("@图片3");
  });
});
