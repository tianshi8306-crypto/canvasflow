export type MainstreamModelCatalogItem = {
  modelName: string;
  defaultApiBaseUrl: string;
  /** API 端点类型："images" | "chat"，默认 "images" */
  endpointType?: "images" | "chat";
  variants: Array<{ label: string; value: string }>;
};

export const MAINSTREAM_IMAGE_MODEL_CATALOG: MainstreamModelCatalogItem[] = [
  {
    modelName: "火山引擎方舟（Doubao）",
    defaultApiBaseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    variants: [
      { label: "Doubao-Seedream-5.0-lite", value: "Doubao-Seedream-5.0-lite" },
    ],
  },
  {
    modelName: "APIYI",
    defaultApiBaseUrl: "https://api.apiyi.com/v1",
    variants: [
      { label: "GPT-Image-2-VIP", value: "gpt-image-2-vip" },
    ],
  },
];

export function variantsByModelName(modelName: string) {
  return MAINSTREAM_IMAGE_MODEL_CATALOG.find((x) => x.modelName === modelName)?.variants ?? [];
}

export function defaultApiBaseUrlByModelName(modelName: string) {
  return MAINSTREAM_IMAGE_MODEL_CATALOG.find((x) => x.modelName === modelName)?.defaultApiBaseUrl ?? "";
}

export function endpointTypeByModelName(modelName: string): "images" | "chat" | undefined {
  return MAINSTREAM_IMAGE_MODEL_CATALOG.find((x) => x.modelName === modelName)?.endpointType;
}
