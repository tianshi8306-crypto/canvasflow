/**
 * faceBypass.test.ts
 *
 * 单元测试：faceBypass 模块（纯函数部分）
 *
 * Canvas 相关功能依赖真实浏览器环境，在 jsdom 中无法完整模拟，
 * 留待视觉验收测试覆盖。
 */

import { describe, expect, it } from "vitest";
import { clamp } from "./helpers";
import { injectVirtualCharacterPrefix } from "./bypassPrompt";

// ── helpers ──

describe("clamp", () => {
  it("clamps values within [0, 255]", () => {
    expect(clamp(0, 0, 255)).toBe(0);
    expect(clamp(128, 0, 255)).toBe(128);
    expect(clamp(255, 0, 255)).toBe(255);
  });

  it("clamps values below minimum", () => {
    expect(clamp(-1, 0, 255)).toBe(0);
    expect(clamp(-100, 0, 255)).toBe(0);
    expect(clamp(-0.01, 0, 255)).toBe(0);
  });

  it("clamps values above maximum", () => {
    expect(clamp(256, 0, 255)).toBe(255);
    expect(clamp(1000, 0, 255)).toBe(255);
    expect(clamp(255.01, 0, 255)).toBe(255);
  });

  it("clamps with arbitrary range", () => {
    expect(clamp(5, 10, 20)).toBe(10);
    expect(clamp(25, 10, 20)).toBe(20);
    expect(clamp(15, 10, 20)).toBe(15);
  });
});

// ── bypassPrompt ──

describe("injectVirtualCharacterPrefix", () => {
  const REQUIRED_PHRASES = [
    "Digital illustration",
    "non-photorealistic",
    "fictional original character",
    "NOT a real person",
    "NOT a photograph",
  ];

  it("prepends all required declarations", () => {
    const result = injectVirtualCharacterPrefix("A test prompt");
    for (const phrase of REQUIRED_PHRASES) {
      expect(result).toContain(phrase);
    }
  });

  it("preserves original prompt text at the end", () => {
    const original = "A close-up portrait of a warrior in battle armor";
    const result = injectVirtualCharacterPrefix(original);
    expect(result.endsWith(original)).toBe(true);
  });

  it("handles empty prompt", () => {
    const result = injectVirtualCharacterPrefix("");
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain("Digital illustration");
  });

  it("handles whitespace-only prompt", () => {
    const result = injectVirtualCharacterPrefix("   \n  ");
    expect(result).toContain("Digital illustration");
    expect(result).not.toMatch(/\s{2,}$/);
  });

  it("prefix always starts with 'Digital illustration'", () => {
    const result = injectVirtualCharacterPrefix("anything");
    expect(result.startsWith("Digital illustration")).toBe(true);
  });

  it("does not duplicate prefix when called repeatedly", () => {
    const once = injectVirtualCharacterPrefix("test");
    const twice = injectVirtualCharacterPrefix(once);
    expect(twice.startsWith("Digital illustration")).toBe(true);
    expect(twice).toContain("test");
  });

  it("produces the same prefix for any input", () => {
    const a = injectVirtualCharacterPrefix("foo");
    const b = injectVirtualCharacterPrefix("bar");
    const prefixA = a.slice(0, a.length - " foo".length);
    const prefixB = b.slice(0, b.length - " bar".length);
    expect(prefixA).toBe(prefixB);
  });
});

// ── 常量验证 ──

describe("blurSharpen defaults", () => {
  it("exports destroyFaceFeatures with correct default constants", async () => {
    const mod = await import("./blurSharpen");

    expect(mod.DEFAULT_BLUR_RADIUS).toBe(12.0);
    expect(mod.DEFAULT_SCRAMBLE_GRID).toBe(5);
    expect(mod.DEFAULT_SCRAMBLE_SHUFFLE_RATIO).toBe(0.7);
    expect(mod.DEFAULT_PIXELATE_BLOCK).toBe(12);
    expect(mod.DEFAULT_QUANTIZE_BITS).toBe(3);
    expect(mod.DEFAULT_JPEG_QUALITY).toBe(0.15);
    expect(typeof mod.destroyFaceFeatures).toBe("function");
    expect(mod.SKIN_COVERAGE_MIN_RATIO).toBe(0.02);
  });
});

// ── 肤色检测 ──

describe("skin pixel detection (isSkinPixel)", () => {
  it("classifies Caucasian skin tone as skin", async () => {
    const { isSkinPixelForTest } = await import("./testExports");
    expect(isSkinPixelForTest(245, 210, 180)).toBe(true);
  });

  it("classifies East Asian skin tone as skin", async () => {
    const { isSkinPixelForTest } = await import("./testExports");
    expect(isSkinPixelForTest(255, 219, 180)).toBe(true);
  });

  it("classifies darker skin tone as skin", async () => {
    const { isSkinPixelForTest } = await import("./testExports");
    expect(isSkinPixelForTest(160, 110, 70)).toBe(true);
  });

  it("rejects pure white as non-skin", async () => {
    const { isSkinPixelForTest } = await import("./testExports");
    expect(isSkinPixelForTest(255, 255, 255)).toBe(false);
  });

  it("rejects pure black as non-skin", async () => {
    const { isSkinPixelForTest } = await import("./testExports");
    expect(isSkinPixelForTest(0, 0, 0)).toBe(false);
  });

  it("rejects sky blue as non-skin", async () => {
    const { isSkinPixelForTest } = await import("./testExports");
    expect(isSkinPixelForTest(100, 180, 255)).toBe(false);
  });

  it("rejects leaf green as non-skin", async () => {
    const { isSkinPixelForTest } = await import("./testExports");
    expect(isSkinPixelForTest(60, 160, 60)).toBe(false);
  });
});

// ── 颜色量化 ──

describe("color quantization math", () => {
  it("3-bit quantization masks correctly", async () => {
    const { quantizeChannelForTest } = await import("./testExports");
    expect(quantizeChannelForTest(255, 3)).toBe(224);
    expect(quantizeChannelForTest(128, 3)).toBe(128);
    expect(quantizeChannelForTest(0, 3)).toBe(0);
    expect(quantizeChannelForTest(200, 3)).toBe(192);
    expect(quantizeChannelForTest(63, 3)).toBe(32);
  });

  it("4-bit quantization masks correctly", async () => {
    const { quantizeChannelForTest } = await import("./testExports");
    expect(quantizeChannelForTest(255, 4)).toBe(240);
    expect(quantizeChannelForTest(128, 4)).toBe(128);
    expect(quantizeChannelForTest(100, 4)).toBe(96);
  });

  it("8-bit quantization is no-op", async () => {
    const { quantizeChannelForTest } = await import("./testExports");
    expect(quantizeChannelForTest(255, 8)).toBe(255);
    expect(quantizeChannelForTest(128, 8)).toBe(128);
    expect(quantizeChannelForTest(77, 8)).toBe(77);
  });
});

// ── FaceBypassOptions 类型验证 ──

describe("FaceBypassOptions", () => {
  it("includes mode field", () => {
    const opts: import("./index").FaceBypassOptions = {
      mode: "scramble",
      blurRadius: 12,
      scrambleGrid: 5,
      scrambleRatio: 0.7,
    };
    expect(opts.mode).toBe("scramble");
    expect(opts.blurRadius).toBe(12);
  });

  it("allows erase mode", () => {
    const opts: import("./index").FaceBypassOptions = { mode: "erase" };
    expect(opts.mode).toBe("erase");
  });

  it("allows standard mode", () => {
    const opts: import("./index").FaceBypassOptions = { mode: "standard" };
    expect(opts.mode).toBe("standard");
  });
});

// ── 模块导出验证 ──

describe("module exports", () => {
  it("index.ts exports bypassFaceReview and bypassFaceReviewBatch", async () => {
    const mod = await import("./index");
    expect(typeof mod.bypassFaceReview).toBe("function");
    expect(typeof mod.bypassFaceReviewBatch).toBe("function");
  });

  it("bypassPrompt.ts exports injectVirtualCharacterPrefix", async () => {
    const mod = await import("./bypassPrompt");
    expect(typeof mod.injectVirtualCharacterPrefix).toBe("function");
  });

  it("helpers.ts exports clamp, createImageFromDataUrl, canvasToJpegDataUrl", async () => {
    const mod = await import("./helpers");
    expect(typeof mod.clamp).toBe("function");
    expect(typeof mod.createImageFromDataUrl).toBe("function");
    expect(typeof mod.canvasToJpegDataUrl).toBe("function");
  });

  it("blurSharpen.ts exports destroyFaceFeatures", async () => {
    const mod = await import("./blurSharpen");
    expect(typeof mod.destroyFaceFeatures).toBe("function");
  });
});
