import { describe, expect, it } from "vitest";
import {
  mediaAssetNodeSubtitle,
  NODE_EMPTY_MEDIA_SUBTITLE,
  NODE_EMPTY_SCRIPT_SUBTITLE,
  NODE_EMPTY_TEXT_SUBTITLE,
  scriptNodeSubtitle,
  textNodeSubtitle,
} from "@/lib/nodeUiStrings";

describe("mediaAssetNodeSubtitle", () => {
  it("returns empty-media hint when no path", () => {
    expect(mediaAssetNodeSubtitle(false, undefined, undefined)).toBe(NODE_EMPTY_MEDIA_SUBTITLE);
  });

  it("returns basename when path set", () => {
    expect(mediaAssetNodeSubtitle(true, "assets/foo/bar.png", undefined)).toBe("bar.png");
  });

  it("returns short asset id when path missing but asset id present", () => {
    expect(mediaAssetNodeSubtitle(true, "", "abcdef12-0000")).toBe("abcdef12…");
  });
});

describe("textNodeSubtitle", () => {
  it("returns empty hint when no body", () => {
    expect(textNodeSubtitle(false, "")).toBe(NODE_EMPTY_TEXT_SUBTITLE);
    expect(textNodeSubtitle(true, "   ")).toBe(NODE_EMPTY_TEXT_SUBTITLE);
  });

  it("truncates long single-line preview", () => {
    const long = "a".repeat(50);
    const s = textNodeSubtitle(true, long, 12);
    expect(s).toMatch(/^a{12}…$/);
  });
});

describe("scriptNodeSubtitle", () => {
  it("returns empty hint when no beats", () => {
    expect(scriptNodeSubtitle(false, 0)).toBe(NODE_EMPTY_SCRIPT_SUBTITLE);
    expect(scriptNodeSubtitle(true, 0)).toBe(NODE_EMPTY_SCRIPT_SUBTITLE);
  });

  it("returns count when beats exist", () => {
    expect(scriptNodeSubtitle(true, 3)).toBe("3 条镜头");
  });
});
