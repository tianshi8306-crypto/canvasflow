import type { ImageModelConfig } from "@/lib/settingsPanelTypes";
import {
  defaultApiBaseUrlByModelName,
  endpointTypeByModelName,
  MAINSTREAM_IMAGE_MODEL_CATALOG,
} from "@/lib/imageGeneration/modelCatalog";

function normalizeApiBaseUrl(raw: string): string {
  let s = raw.trim();
  if (!s) return s;
  if (!/^https?:\/\//i.test(s)) {
    s = `https://${s}`;
  }
  s = s.replace(/\/+$/, "");
  if (!s.endsWith("/v1") && /api\.apiyi\.com/i.test(s)) {
    s = `${s}/v1`;
  }
  return s;
}

function inferVendorName(m: ImageModelConfig): string {
  if (m.modelName && MAINSTREAM_IMAGE_MODEL_CATALOG.some((x) => x.modelName === m.modelName)) {
    return m.modelName;
  }
  const key = `${m.model ?? ""} ${m.modelVariant ?? ""} ${m.vendorName ?? ""}`.toLowerCase();
  if (key.includes("gpt-image") || key.includes("apiyi")) {
    return "APIYI";
  }
  return m.modelName || m.vendorName || "";
}

/** 加载/导入设置时修正 APIYI 等模型的地址与端点类型 */
export function normalizeImageModelConfigOnLoad(m: ImageModelConfig): ImageModelConfig {
  const vendorName = inferVendorName(m);
  const catalogDefault = vendorName ? defaultApiBaseUrlByModelName(vendorName) : "";
  let apiBaseUrl = normalizeApiBaseUrl(m.apiBaseUrl || catalogDefault);
  if (!apiBaseUrl && catalogDefault) {
    apiBaseUrl = normalizeApiBaseUrl(catalogDefault);
  }

  const modelLower = `${m.model ?? ""} ${m.modelVariant ?? ""}`.toLowerCase();
  let endpointType = m.endpointType;
  if (modelLower.includes("gpt-image") && /api\.apiyi\.com/i.test(apiBaseUrl)) {
    // gpt-image-2-vip 官方推荐 /v1/images/generations（支持 size 参数）
    endpointType = "images";
  } else if (!endpointType && vendorName) {
    endpointType = endpointTypeByModelName(vendorName);
  }

  return {
    ...m,
    vendorName,
    modelName: m.modelName || vendorName,
    apiBaseUrl,
    endpointType,
  };
}
