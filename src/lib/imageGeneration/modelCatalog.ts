export type MainstreamModelCatalogItem = {
  modelName: string;
  defaultApiBaseUrl: string;
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
];

export function variantsByModelName(modelName: string) {
  return MAINSTREAM_IMAGE_MODEL_CATALOG.find((x) => x.modelName === modelName)?.variants ?? [];
}

export function defaultApiBaseUrlByModelName(modelName: string) {
  return MAINSTREAM_IMAGE_MODEL_CATALOG.find((x) => x.modelName === modelName)?.defaultApiBaseUrl ?? "";
}
