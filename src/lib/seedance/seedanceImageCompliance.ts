/**
 * Seedance 2.0 上游参考图合规（LibTV 蓝勾同源规则）。
 * 全自动校验：格式 / 宽高比 / 边长 / 文件大小。
 */

import type { ValidationError } from "@/lib/seedance/validation";

export const SEEDANCE_IMAGE_COMPLIANCE_FORMATS = [
  "jpeg",
  "jpg",
  "png",
  "webp",
  "bmp",
  "tiff",
  "tif",
  "gif",
  "heic",
  "heif",
] as const;

export type SeedanceImageComplianceFormat = (typeof SEEDANCE_IMAGE_COMPLIANCE_FORMATS)[number];

/** 宽/高（开区间，不含端点） */
export const SEEDANCE_IMAGE_ASPECT_RATIO_MIN = 0.4;
export const SEEDANCE_IMAGE_ASPECT_RATIO_MAX = 2.5;

/** 宽、高像素（闭区间） */
export const SEEDANCE_IMAGE_DIMENSION_MIN_PX = 300;
export const SEEDANCE_IMAGE_DIMENSION_MAX_PX = 6000;

export const SEEDANCE_IMAGE_MAX_BYTES = 30 * 1024 * 1024;

export type SeedanceImageComplianceProbe = {
  /** 小写扩展名，无点 */
  format?: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
};

export type SeedanceImageComplianceStatus = "pending" | "pass" | "fail" | "unknown";

export type SeedanceImageComplianceResult = {
  status: SeedanceImageComplianceStatus;
  /** 仅 status === "pass" 时为 true */
  pass: boolean;
  errors: string[];
  warnings: string[];
  meta: {
    format?: string;
    width?: number;
    height?: number;
    sizeBytes?: number;
    aspectRatio?: number;
  };
};

export function normalizeImageFormatExt(extOrPath: string | undefined): string | undefined {
  if (!extOrPath?.trim()) return undefined;
  const raw = extOrPath.trim().toLowerCase();
  const ext = raw.includes(".") ? raw.split(".").pop()! : raw;
  if (ext === "jpg") return "jpeg";
  return ext;
}

export function isSeedanceImageFormatSupported(format: string | undefined): boolean {
  const n = normalizeImageFormatExt(format);
  if (!n) return false;
  return (SEEDANCE_IMAGE_COMPLIANCE_FORMATS as readonly string[]).includes(n === "jpg" ? "jpeg" : n);
}

export function evaluateSeedanceImageCompliance(
  probe: SeedanceImageComplianceProbe,
): SeedanceImageComplianceResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const format = normalizeImageFormatExt(probe.format);
  const width = probe.width;
  const height = probe.height;
  const sizeBytes = probe.sizeBytes;
  const aspectRatio =
    width != null && height != null && height > 0 ? width / height : undefined;

  if (!format) {
    errors.push("无法识别图片格式");
  } else if (!isSeedanceImageFormatSupported(format)) {
    errors.push(
      `格式 ${format} 不受支持（支持：jpeg、png、webp、bmp、tiff、gif、heic/heif）`,
    );
  }

  if (width == null || height == null || width <= 0 || height <= 0) {
    errors.push("无法读取图片宽高");
  } else {
    if (width < SEEDANCE_IMAGE_DIMENSION_MIN_PX || width > SEEDANCE_IMAGE_DIMENSION_MAX_PX) {
      errors.push(
        `宽度 ${width}px 不在 ${SEEDANCE_IMAGE_DIMENSION_MIN_PX}–${SEEDANCE_IMAGE_DIMENSION_MAX_PX}px 范围内`,
      );
    }
    if (height < SEEDANCE_IMAGE_DIMENSION_MIN_PX || height > SEEDANCE_IMAGE_DIMENSION_MAX_PX) {
      errors.push(
        `高度 ${height}px 不在 ${SEEDANCE_IMAGE_DIMENSION_MIN_PX}–${SEEDANCE_IMAGE_DIMENSION_MAX_PX}px 范围内`,
      );
    }
    if (aspectRatio != null) {
      if (
        aspectRatio <= SEEDANCE_IMAGE_ASPECT_RATIO_MIN ||
        aspectRatio >= SEEDANCE_IMAGE_ASPECT_RATIO_MAX
      ) {
        errors.push(
          `宽高比 ${aspectRatio.toFixed(2)} 不在 (${SEEDANCE_IMAGE_ASPECT_RATIO_MIN}, ${SEEDANCE_IMAGE_ASPECT_RATIO_MAX}) 范围内`,
        );
      }
    }
  }

  if (sizeBytes == null) {
    warnings.push("未能校验文件大小（请使用桌面版打开工程）");
  } else if (sizeBytes > SEEDANCE_IMAGE_MAX_BYTES) {
    errors.push(
      `文件大小 ${(sizeBytes / 1024 / 1024).toFixed(2)}MB 超过 30MB 限制`,
    );
  }

  const hasDimensions = width != null && height != null && width > 0 && height > 0;
  const hasFormat = Boolean(format && isSeedanceImageFormatSupported(format));
  const aspectOk =
    aspectRatio != null &&
    aspectRatio > SEEDANCE_IMAGE_ASPECT_RATIO_MIN &&
    aspectRatio < SEEDANCE_IMAGE_ASPECT_RATIO_MAX;
  const widthOk =
    hasDimensions &&
    width! >= SEEDANCE_IMAGE_DIMENSION_MIN_PX &&
    width! <= SEEDANCE_IMAGE_DIMENSION_MAX_PX;
  const heightOk =
    hasDimensions &&
    height! >= SEEDANCE_IMAGE_DIMENSION_MIN_PX &&
    height! <= SEEDANCE_IMAGE_DIMENSION_MAX_PX;
  const sizeOk = sizeBytes != null && sizeBytes <= SEEDANCE_IMAGE_MAX_BYTES;

  let status: SeedanceImageComplianceStatus;
  if (hasFormat && widthOk && heightOk && aspectOk && sizeOk) {
    status = "pass";
  } else if (
    errors.some((e) => e.includes("无法读取") || e.includes("无法识别")) &&
    !errors.some(
      (e) =>
        e.includes("不受支持") ||
        e.includes("宽高比") ||
        e.includes("宽度") ||
        e.includes("高度") ||
        e.includes("30MB"),
    )
  ) {
    status = "unknown";
  } else if (errors.length > 0) {
    status = "fail";
  } else {
    status = "unknown";
  }

  return {
    status,
    pass: status === "pass",
    errors,
    warnings,
    meta: { format, width, height, sizeBytes, aspectRatio },
  };
}

export type SeedanceComplianceRefContext = {
  edgeId: string;
  /** 参考条序号或「首帧」等展示名 */
  badgeLabel: string;
};

/** 将合规 Map 转为生成前可拦截的 ValidationError 列表 */
export function collectSeedanceImageComplianceValidationErrors(
  refs: SeedanceComplianceRefContext[],
  byEdge: ReadonlyMap<string, SeedanceImageComplianceResult>,
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const ref of refs) {
    const r = byEdge.get(ref.edgeId);
    if (!r) continue;
    if (r.status === "pending") {
      errors.push({
        code: "SEEDANCE_COMPLIANCE_PENDING",
        message: `参考 ${ref.badgeLabel}：Seedance 合规校验中，请稍候`,
      });
      continue;
    }
    if (r.pass) continue;
    const detail = [...r.errors, ...r.warnings].filter(Boolean).join("；");
    errors.push({
      code: "SEEDANCE_IMAGE_NON_COMPLIANT",
      message: `参考 ${ref.badgeLabel} 不符合 Seedance 2.0 规格：${seedanceComplianceSummary(r)}`,
      detail: detail || undefined,
    });
  }
  return errors;
}

export function mergeSeedanceComplianceIntoValidation(
  base: { valid: boolean; errors: ValidationError[] },
  complianceErrors: ValidationError[],
): { valid: boolean; errors: ValidationError[] } {
  if (complianceErrors.length === 0) return base;
  return {
    valid: false,
    errors: [...base.errors, ...complianceErrors],
  };
}

export function seedanceComplianceSummary(result: SeedanceImageComplianceResult): string {
  if (result.pass) return "Seedance 2.0 合规";
  if (result.status === "pending") return "合规校验中…";
  if (result.status === "unknown") {
    return result.errors[0] ?? result.warnings[0] ?? "合规信息不完整";
  }
  return result.errors[0] ?? "不符合 Seedance 2.0 图片规格";
}
