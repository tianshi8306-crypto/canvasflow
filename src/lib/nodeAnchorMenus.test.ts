import { describe, expect, it } from "vitest";
import {
  anchorMenuTitle,
  getIncomingAnchorRows,
  getIncomingExtraRows,
  getIncomingMenuRows,
  getOutgoingAnchorRows,
} from "@/lib/nodeAnchorMenus";

describe("nodeAnchorMenus P0 filtering", () => {
  it("scriptNode incoming excludes image and script self-loop", () => {
    const keys = getIncomingAnchorRows("scriptNode").map((r) => r.key);
    expect(keys).toContain("textNode");
    expect(keys).not.toContain("imageNode");
    expect(keys).not.toContain("scriptNode");
  });

  it("audioNode incoming excludes image", () => {
    const keys = getIncomingAnchorRows("audioNode").map((r) => r.key);
    expect(keys).toContain("textNode");
    expect(keys).not.toContain("imageNode");
  });

  it("audioNode outgoing is mainly video", () => {
    const keys = getOutgoingAnchorRows("audioNode").map((r) => r.key);
    expect(keys).toContain("videoNode");
    expect(keys).not.toContain("textNode");
    expect(keys).not.toContain("imageNode");
  });

  it("videoNode incoming includes script audio and reference video", () => {
    const keys = getIncomingAnchorRows("videoNode").map((r) => r.key);
    expect(keys).toEqual(
      expect.arrayContaining(["imageNode", "videoNode", "audioNode", "textNode", "scriptNode"]),
    );
  });

  it("videoNode simple extras include first/last frame wizards", () => {
    const keys = getIncomingExtraRows("videoNode").map((r) => r.key);
    expect(keys).toContain("videoFirstLastSetup");
    expect(keys).toContain("videoFirstFrameSetup");
  });

  it("textNode outgoing includes audio", () => {
    const keys = getOutgoingAnchorRows("textNode").map((r) => r.key);
    expect(keys).toContain("audioNode");
  });

  it("imageNode incoming includes script", () => {
    const keys = getIncomingAnchorRows("imageNode").map((r) => r.key);
    expect(keys).toContain("scriptNode");
  });

  it("ffmpegConcat incoming allows video only (no chained concat)", () => {
    const keys = getIncomingAnchorRows("ffmpegConcat").map((r) => r.key);
    expect(keys).toEqual(["videoNode"]);
  });

  it("scriptNode incoming extra offers LLM", () => {
    const keys = getIncomingExtraRows("scriptNode").map((r) => r.key);
    expect(keys).toContain("llm");
  });

  it("videoNode outgoing prioritizes ffmpeg concat", () => {
    const keys = getOutgoingAnchorRows("videoNode").map((r) => r.key);
    expect(keys[0]).toBe("ffmpegConcat");
  });

  it("unified anchor menu titles", () => {
    expect(anchorMenuTitle("incoming")).toBe("添加上游输入");
    expect(anchorMenuTitle("outgoing")).toBe("引出输出");
  });

  it("getIncomingMenuRows puts extras before filtered rows", () => {
    const keys = getIncomingMenuRows("videoNode").map((r) => r.key);
    expect(keys[0]).toBe("videoFirstLastSetup");
    expect(keys).toContain("imageNode");
  });

  it("mediaImport incoming is empty", () => {
    expect(getIncomingAnchorRows("mediaImport")).toEqual([]);
  });
});
