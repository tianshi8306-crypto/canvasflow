import type { ImageTaskMode } from "@/lib/imageGeneration/catalog";

/** 连入图片节点的上游参考（采集阶段，路径可能尚未解析） */
export type IncomingImageRef = {
  sourceNodeId: string;
  path?: string;
  assetId?: string;
  y: number;
};

/** 解析后的上游参考图 */
export type ResolvedIncomingImageRef = IncomingImageRef & {
  resolvedPath: string;
};

export type ImageGenerationContext = {
  incomingImageRefs: IncomingImageRef[];
  resolvedRefs: ResolvedIncomingImageRef[];
  aggregatedPrompt: string;
  task: ImageTaskMode | null;
  referenceImagePaths: string[];
  blockReason: string | null;
  warnMessage: string | null;
};
