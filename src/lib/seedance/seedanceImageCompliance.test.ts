import { describe, expect, it } from "vitest";
import {
  collectSeedanceImageComplianceValidationErrors,
  evaluateSeedanceImageCompliance,
  isSeedanceImageFormatSupported,
  mergeSeedanceComplianceIntoValidation,
  normalizeImageFormatExt,
} from "./seedanceImageCompliance";

describe("seedanceImageCompliance", () => {
  it("normalizes jpg to jpeg", () => {
    expect(normalizeImageFormatExt("photo.JPG")).toBe("jpeg");
    expect(normalizeImageFormatExt("assets/a.heic")).toBe("heic");
  });

  it("accepts supported formats", () => {
    expect(isSeedanceImageFormatSupported("webp")).toBe(true);
    expect(isSeedanceImageFormatSupported("heif")).toBe(true);
    expect(isSeedanceImageFormatSupported("svg")).toBe(false);
  });

  it("passes valid 9:16 image with size", () => {
    const r = evaluateSeedanceImageCompliance({
      format: "png",
      width: 1080,
      height: 1920,
      sizeBytes: 2 * 1024 * 1024,
    });
    expect(r.pass).toBe(true);
    expect(r.status).toBe("pass");
  });

  it("fails aspect ratio out of range", () => {
    const r = evaluateSeedanceImageCompliance({
      format: "jpeg",
      width: 3000,
      height: 500,
      sizeBytes: 1024,
    });
    expect(r.pass).toBe(false);
    expect(r.errors.some((e) => e.includes("宽高比"))).toBe(true);
  });

  it("fails over 30MB", () => {
    const r = evaluateSeedanceImageCompliance({
      format: "png",
      width: 1024,
      height: 1024,
      sizeBytes: 31 * 1024 * 1024,
    });
    expect(r.pass).toBe(false);
    expect(r.errors.some((e) => e.includes("30MB"))).toBe(true);
  });

  it("unknown when dimensions missing but format ok", () => {
    const r = evaluateSeedanceImageCompliance({ format: "png" });
    expect(r.status).toBe("unknown");
    expect(r.pass).toBe(false);
  });
});

describe("collectSeedanceImageComplianceValidationErrors", () => {
  it("blocks pending and failed refs", () => {
    const map = new Map([
      [
        "e1",
        {
          status: "fail" as const,
          pass: false,
          errors: ["宽度 100px 不在 300–6000px 范围内"],
          warnings: [],
          meta: {},
        },
      ],
      [
        "e2",
        {
          status: "pending" as const,
          pass: false,
          errors: [],
          warnings: [],
          meta: {},
        },
      ],
      [
        "e3",
        {
          status: "pass" as const,
          pass: true,
          errors: [],
          warnings: [],
          meta: {},
        },
      ],
    ]);
    const errs = collectSeedanceImageComplianceValidationErrors(
      [
        { edgeId: "e1", badgeLabel: "3" },
        { edgeId: "e2", badgeLabel: "4" },
        { edgeId: "e3", badgeLabel: "5" },
      ],
      map,
    );
    expect(errs).toHaveLength(2);
    expect(errs[0]?.message).toContain("参考 3");
    expect(errs[1]?.message).toContain("校验中");
  });

  it("mergeSeedanceComplianceIntoValidation marks invalid", () => {
    const merged = mergeSeedanceComplianceIntoValidation(
      { valid: true, errors: [] },
      [{ code: "SEEDANCE_IMAGE_NON_COMPLIANT", message: "bad" }],
    );
    expect(merged.valid).toBe(false);
    expect(merged.errors).toHaveLength(1);
  });
});
