import { VIDEO_MODEL_CATALOG, modelSupportsWorkflow } from "@/lib/videoGeneration/catalog";
import type { VideoGenerationWorkflow } from "@/lib/videoNodeTypes";
import type { VideoModelOption } from "@/hooks/useVideoModels";

/** 按当前工作流过滤视频模型（自定义 settings 项始终保留） */
export function filterVideoModelsForWorkflow(
  models: VideoModelOption[],
  workflow: VideoGenerationWorkflow,
): VideoModelOption[] {
  return models.filter((m) => {
    if (m.settingsId) return true;
    const entry = VIDEO_MODEL_CATALOG.find((c) => c.id === m.id);
    if (!entry) return true;
    return modelSupportsWorkflow(entry, workflow);
  });
}
