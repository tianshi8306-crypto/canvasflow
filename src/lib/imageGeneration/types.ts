import type { ImageTaskMode } from "@/lib/imageGeneration/catalog";

export type ImagePanelRefKind = "image" | "text";

/** 图片生成面板参考条项（图片预览 + 上游文本） */
export type IncomingImagePanelRef =
  | {
      kind: "image";
      edgeId: string;
      sourceNodeId: string;
      path?: string;
      assetId?: string;
      y: number;
      nodeLabel: string;
    }
  | {
      kind: "text";
      edgeId: string;
      sourceNodeId: string;
      y: number;
      nodeLabel: string;
      textContent: string;
    };

export type ResolvedIncomingImagePanelRef = IncomingImagePanelRef & {
  resolvedPath?: string;
};

/** 连入图片节点的上游参考图（采集阶段，路径可能尚未解析） */
export type IncomingImageRef = Extract<IncomingImagePanelRef, { kind: "image" }>;

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
