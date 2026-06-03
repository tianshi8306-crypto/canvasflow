import type { VideoGenerationWorkflow, VideoModelId } from "@/lib/videoNodeTypes";
import { dreaminaCliVideoOptions } from "@/lib/dreamina/cliModels";

export type { VideoModelCapabilities } from "@/lib/videoGeneration/modelCapabilities";
export {
  formatVideoModelCapabilitySubtitle,
  getVideoModelCapabilities,
  isCatalogResolutionSupported,
  normalizeVideoOutputForModel,
  supportedCatalogResolutions,
} from "@/lib/videoGeneration/modelCapabilities";

export type VideoModelCatalogEntry = {
  id: VideoModelId;
  /** 展示名 */
  label: string;
  /** 供应商/池内分组 */
  provider: "doubao" | "dreamina";
  /** 未列出表示支持全部已声明工作流 */
  supportedWorkflows?: VideoGenerationWorkflow[];
};

/** 视频节点模型下拉：内置默认（Doubao API + 即梦 CLI 全量） */
export const VIDEO_BUILTIN_MODEL_OPTIONS: { id: string; label: string }[] = [
  { id: "doubao_seedance_2_0", label: "Doubao Seedance 2.0" },
  ...dreaminaCliVideoOptions(),
];

/** Mock / 文档用模型池 */
export const VIDEO_MODEL_CATALOG: VideoModelCatalogEntry[] = [
  {
    id: "doubao_seedance_2_0",
    label: "Doubao-Seedance-2.0",
    provider: "doubao",
    supportedWorkflows: undefined,
  },
  ...VIDEO_BUILTIN_MODEL_OPTIONS.filter((m) => m.id.startsWith("dreamina/")).map((m) => ({
    id: m.id,
    label: m.label.replace("（CLI）", ""),
    provider: "dreamina" as const,
  })),
];

export const VIDEO_WORKFLOW_TAB_LABELS: { workflow: VideoGenerationWorkflow; label: string }[] = [
  { workflow: "text_to_video", label: "文生视频" },
  { workflow: "multimodal_reference", label: "全能参考" },
  { workflow: "image_to_video", label: "图生视频" },
  { workflow: "first_last_frame", label: "首尾帧" },
  { workflow: "image_reference", label: "图片参考" },
  { workflow: "video_reference", label: "参考视频" },
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
