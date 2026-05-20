import type { ImageTaskMode } from "@/lib/imageGeneration/catalog";

export type DetectImageTaskResult = {
  task: ImageTaskMode;
  referenceImagePaths: string[];
};

/**
 * 根据已解析的参考图路径数量推断 task（要求调用方已校验有效提示词）。
 */
export function detectImageTask(referenceImagePaths: string[]): DetectImageTaskResult {
  const paths = referenceImagePaths.filter((p) => p.trim().length > 0);
  const n = paths.length;

  if (n === 0) {
    return { task: "text_to_image", referenceImagePaths: [] };
  }
  if (n === 1) {
    return { task: "image_to_image", referenceImagePaths: [paths[0]!] };
  }
  return { task: "multi_ref_fusion", referenceImagePaths: paths.slice(0, 4) };
}

/** 顶栏 meta 方钮短文案（与「风格」「标记」同尺寸） */
export function imageTaskMetaChipLabel(
  task: ImageTaskMode | undefined,
  refCount: number,
): string {
  if (refCount > 0) return "参考";
  if (!task || task === "text_to_image") return "文生图";
  switch (task) {
    case "image_to_image":
      return "图生图";
    case "multi_ref_fusion":
      return "多图融合";
    case "image_edit":
      return "图像编辑";
    default:
      return "文生图";
  }
}

/** 只读 UI 文案（A2 接入面板） */
export function imageTaskStatusLabel(task: ImageTaskMode, refCount: number): string {
  switch (task) {
    case "text_to_image":
      return "文生图";
    case "image_to_image":
      return `图生图（${refCount} 张参考）`;
    case "multi_ref_fusion":
      return `多图融合（${refCount} 张参考）`;
    case "image_edit":
      return "图像编辑";
    default:
      return "文生图";
  }
}
