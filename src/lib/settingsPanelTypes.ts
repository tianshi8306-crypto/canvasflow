export type ProviderConfig = {
  id: string;
  label: string;
  baseUrl: string;
  model: string;
  priority: number;
  enabled: boolean;
};

export type ImageModelConfig = {
  id: string;
  vendorName: string;
  modelName: string;
  modelVariant: string;
  label: string;
  model: string;
  apiBaseUrl: string;
  enabled: boolean;
  priority: number;
};

export type AppSettings = {
  providers: ProviderConfig[];
  imageModels: ImageModelConfig[];
  videoModels: ImageModelConfig[];
  audioModels: ImageModelConfig[];
  defaultProviderId: string | null;
  ffmpegPath: string | null;
  /** 为 true 时任一节点失败即中止整图（默认 false：失败则跳过下游） */
  abortWorkflowOnFailure: boolean;
};

export type KeyPreviewItem = {
  masked: string;
  savedAt: string;
};
