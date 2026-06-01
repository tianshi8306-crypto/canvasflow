import { describe, expect, it } from "vitest";
import {
  resolveRefAssetsChatIntent,
} from "@/lib/hermes/hermesRefAssetsChat";
import { formatHermesRefsForChat } from "@/lib/hermes/hermesRefAssets";

describe("hermesRefAssetsChat", () => {
  it("detects list and add intents", () => {
    expect(resolveRefAssetsChatIntent("列出参考素材")).toBe("list");
    expect(resolveRefAssetsChatIntent("把霓虹加为参考")).toBe("add");
    expect(resolveRefAssetsChatIntent("导入参考图片")).toBe("import");
    expect(resolveRefAssetsChatIntent("分镜出图")).toBe(null);
  });

  it("formats empty ref list", () => {
    expect(formatHermesRefsForChat([])).toContain("没有钉选");
  });
});
