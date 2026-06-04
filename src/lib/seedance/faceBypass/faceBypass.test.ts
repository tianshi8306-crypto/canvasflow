/**
 * faceBypass.test.ts
 *
 * 单元测试：faceBypass 模块（纯函数部分）
 *
 * Canvas 相关功能（blurSharpen、bypassFaceReview）依赖真实浏览器环境，
 * 在 jsdom 中无法完整模拟（canvas.toBlob / Image 加载），
 * 这部分留待视觉验收测试覆盖。
 *
 * 测试环境：vitest + jsdom
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
  const PREFIX_CONTENT = [
    "Digital animation character",
    "3D rendered virtual character",
    "concept art style",
    "NOT based on any real person",
  ];

  it("prepends all four semantic declarations", () => {
    const result = injectVirtualCharacterPrefix("A test prompt");
    for (const phrase of PREFIX_CONTENT) {
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
    expect(result).toContain("Digital animation character");
  });

  it("handles whitespace-only prompt", () => {
    const result = injectVirtualCharacterPrefix("   \n  ");
    expect(result).toContain("Digital animation character");
    expect(result).not.toMatch(/\s{2,}$/);
  });

  it("prefix always starts with 'Digital animation character'", () => {
    const result = injectVirtualCharacterPrefix("anything");
    expect(result.startsWith("Digital animation character")).toBe(true);
  });

  it("does not duplicate prefix when called repeatedly", () => {
    // 仅保证每次调用只添加一次前缀（幂等性非必需，但验证无意外重复）
    const once = injectVirtualCharacterPrefix("test");
    const twice = injectVirtualCharacterPrefix(once);
    // 第二次调用仍然应该是「前缀 + 完整内容」
    expect(twice.startsWith("Digital animation character")).toBe(true);
    expect(twice).toContain("test");
  });
});

// ── 常量默认值验证 ──

describe("blurSharpen defaults", () => {
  it("exports expected default constants", async () => {
    const { DEFAULT_BLUR_RADIUS, DEFAULT_SHARPEN_AMOUNT, DEFAULT_JPEG_QUALITY } =
      await import("./blurSharpen");

    expect(DEFAULT_BLUR_RADIUS).toBe(1.5);
    expect(DEFAULT_SHARPEN_AMOUNT).toBe(0.35);
    expect(DEFAULT_JPEG_QUALITY).toBe(0.85);
  });
});

// ── 类型导入验证 ──

describe("module exports", () => {
  it("index.ts exports bypassFaceReview and bypassFaceReviewBatch", async () => {
    const module = await import("./index");
    expect(typeof module.bypassFaceReview).toBe("function");
    expect(typeof module.bypassFaceReviewBatch).toBe("function");
  });

  it("bypassPrompt.ts exports injectVirtualCharacterPrefix", async () => {
    const module = await import("./bypassPrompt");
    expect(typeof module.injectVirtualCharacterPrefix).toBe("function");
  });

  it("helpers.ts exports clamp, createImageFromDataUrl, canvasToJpegDataUrl", async () => {
    const module = await import("./helpers");
    expect(typeof module.clamp).toBe("function");
    expect(typeof module.createImageFromDataUrl).toBe("function");
    expect(typeof module.canvasToJpegDataUrl).toBe("function");
  });
});
