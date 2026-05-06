import type { VideoGenerationWorkflow, VideoModelId } from "@/lib/videoNodeTypes";

export type VideoModelCatalogEntry = {
  id: VideoModelId;
  /** 展示名 */
  label: string;
  /** 供应商/池内分组 */
  provider: "doubao";
  /** 未列出表示支持全部已声明工作流 */
  supportedWorkflows?: VideoGenerationWorkflow[];
};

/** 当前版本：火山引擎视频模型池 */
export const VIDEO_MODEL_CATALOG: VideoModelCatalogEntry[] = [
  { id: "doubao_seedance_2_0", label: "Doubao-Seedance-2.0", provider: "doubao" },
];

export const VIDEO_WORKFLOW_TAB_LABELS: { workflow: VideoGenerationWorkflow; label: string }[] = [
  { workflow: "text_to_video", label: "文生视频" },
  { workflow: "multimodal_reference", label: "全能参考" },
  { workflow: "image_to_video", label: "图生视频" },
  { workflow: "first_last_frame", label: "首尾帧" },
  { workflow: "image_reference", label: "图片参考" },
];

export function modelSupportsWorkflow(
  model: VideoModelCatalogEntry,
  workflow: VideoGenerationWorkflow,
): boolean {
  if (!model.supportedWorkflows || model.supportedWorkflows.length === 0) return true;
  return model.supportedWorkflows.includes(workflow);
}

export function listModelsForWorkflow(workflow: VideoGenerationWorkflow): VideoModelCatalogEntry[] {
  return VIDEO_MODEL_CATALOG.filter((m) => modelSupportsWorkflow(m, workflow));
}
