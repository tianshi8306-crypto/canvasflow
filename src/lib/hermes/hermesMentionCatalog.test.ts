import { describe, expect, it } from "vitest";
import type { FlowNodeData } from "@/lib/types";
import type { Node } from "@xyflow/react";
import {
  buildHermesMentionCatalog,
  formatHermesMentionsForLlm,
  imageRefPathsFromMentions,
  pinHermesMentionToRefStrip,
  resolveHermesMentionsFromCatalog,
} from "./hermesMentionCatalog";
import { loadHermesRefAssets } from "./hermesRefAssets";
import type { HermesRefAsset } from "./hermesRefAssets";

function node(
  id: string,
  type: string,
  data: Partial<FlowNodeData>,
  y: number,
): Node<FlowNodeData> {
  return {
    id,
    type,
    position: { x: 0, y },
    data: data as FlowNodeData,
  };
}

const pinned: HermesRefAsset[] = [
  {
    pinId: "p1",
    assetId: "a1",
    relPath: "assets/ref.png",
    mentionName: "定妆",
    mediaType: "image",
    pinnedAt: 1,
  },
];

describe("hermesMentionCatalog", () => {
  it("indexes canvas media and text nodes", () => {
    const nodes = [
      node("i1", "imageNode", { path: "assets/a.png", label: "主角" }, 0),
      node("v1", "videoNode", { path: "assets/b.mp4", label: "成片" }, 10),
      node("a1", "audioNode", { path: "assets/c.mp3", label: "配乐" }, 20),
      node("t1", "textNode", { prompt: "开场白", label: "文案" }, 30),
      node("s1", "scriptNode", { label: "主脚本", scriptBeats: [{ id: "b1" } as never] }, 40),
    ];
    const catalog = buildHermesMentionCatalog(nodes, []);
    expect(catalog.some((c) => c.insertToken === "@图1")).toBe(true);
    expect(catalog.some((c) => c.insertToken === "@视频1")).toBe(true);
    expect(catalog.some((c) => c.insertToken === "@音频1")).toBe(true);
    expect(catalog.some((c) => c.insertToken === "@文本1")).toBe(true);
    expect(catalog.some((c) => c.insertToken === "@脚本1")).toBe(true);
  });

  it("resolves @图1 and @label aliases", () => {
    const nodes = [node("i1", "imageNode", { path: "assets/hero.png", label: "主角" }, 0)];
    const catalog = buildHermesMentionCatalog(nodes, pinned);
    const resolved = resolveHermesMentionsFromCatalog("按 @图1 与 @主角 参考 @定妆", catalog);
    expect(resolved.length).toBeGreaterThanOrEqual(2);
    expect(resolved.some((r) => r.token === "@图1")).toBe(true);
    expect(resolved.some((r) => r.relPath?.includes("hero.png"))).toBe(true);
  });

  it("formats llm appendix with paths and text", () => {
    const nodes = [node("t1", "textNode", { prompt: "你好世界", label: "旁白" }, 0)];
    const catalog = buildHermesMentionCatalog(nodes, []);
    const resolved = resolveHermesMentionsFromCatalog("用 @文本1", catalog);
    const block = formatHermesMentionsForLlm(resolved);
    expect(block).toContain("[Hermes @ 引用素材]");
    expect(block).toContain("你好世界");
  });

  it("pinHermesMentionToRefStrip adds canvas image to ref strip", () => {
    const projectPath = "/tmp/hermes-pin-test";
    localStorage.removeItem(`canvasflow.hermesRefs.v1:${projectPath}`);
    const nodes = [node("i1", "imageNode", { path: "assets/hero.png", assetId: "aid1" }, 0)];
    const catalog = buildHermesMentionCatalog(nodes, []);
    const item = catalog.find((c) => c.insertToken === "@图1");
    expect(item).toBeTruthy();
    pinHermesMentionToRefStrip(projectPath, item!);
    const refs = loadHermesRefAssets(projectPath);
    expect(refs).toHaveLength(1);
    expect(refs[0]?.mentionName).toBe("图1");
    expect(refs[0]?.relPath).toBe("assets/hero.png");
    localStorage.removeItem(`canvasflow.hermesRefs.v1:${projectPath}`);
  });

  it("imageRefPathsFromMentions keeps images only", () => {
    const nodes = [
      node("i1", "imageNode", { path: "assets/a.png" }, 0),
      node("a1", "audioNode", { path: "assets/b.mp3" }, 1),
    ];
    const catalog = buildHermesMentionCatalog(nodes, []);
    const resolved = resolveHermesMentionsFromCatalog("@图1 @音频1", catalog);
    expect(imageRefPathsFromMentions(resolved)).toEqual(["assets/a.png"]);
  });
});
