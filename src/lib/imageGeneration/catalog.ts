export type ImageModelOption = {
  id: string;
  label: string;
};

export const IMAGE_MODEL_OPTIONS: ImageModelOption[] = [
  { id: "Doubao-Seedream-5.0-lite", label: "Doubao-Seedream-5.0-lite" },
];

export type ImageTaskMode = "text_to_image" | "image_to_image" | "multi_ref_fusion" | "image_edit";

export const IMAGE_TASK_OPTIONS: Array<{ id: ImageTaskMode; label: string }> = [
  { id: "text_to_image", label: "文生图" },
  { id: "image_to_image", label: "图生图" },
  { id: "multi_ref_fusion", label: "多图参考融合" },
  { id: "image_edit", label: "图像编辑" },
];
