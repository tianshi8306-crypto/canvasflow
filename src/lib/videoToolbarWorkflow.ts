import type { VideoGenerationDraft } from "@/lib/videoNodeTypes";

export type VideoToolbarWorkflowMode = "parse" | "hd" | "subtitle-auto";

/** 解析：引导用户用参考视频 + 提示词描述画面 */
export const VIDEO_PARSE_PROMPT_SEED =
  "请根据参考视频解析画面内容、镜头运动与节奏，输出可用于再生成的详细描述：";

/** 高清：引导超分/重生成（实际效果取决于所选视频模型） */
export const VIDEO_HD_PROMPT_SEED =
  "提升视频清晰度，保持画面内容与运动一致，减少模糊与压缩噪点。";

/** 去字幕：引导参考视频重生成（专用去字幕 API 待接） */
export const VIDEO_SUBTITLE_PROMPT_SEED =
  "去除视频画面中的硬字幕与底部文字条，保持其他画面内容、运动与自然：";

export function mergeDraftForVideoToolbarWorkflow(
  draft: VideoGenerationDraft,
  videoRelPath: string,
  mode: VideoToolbarWorkflowMode,
): VideoGenerationDraft {
  const refs = new Set(draft.referenceVideoPaths ?? []);
  if (videoRelPath.trim()) refs.add(videoRelPath.trim());

  const promptEmpty = !draft.prompt.trim();
  const prompt =
    mode === "parse"
      ? promptEmpty
        ? VIDEO_PARSE_PROMPT_SEED
        : draft.prompt
      : mode === "subtitle-auto"
        ? promptEmpty
          ? VIDEO_SUBTITLE_PROMPT_SEED
          : draft.prompt
        : promptEmpty
          ? VIDEO_HD_PROMPT_SEED
          : draft.prompt;

  const output =
    mode === "hd" ? { ...draft.output, resolution: "1080P" as const } : draft.output;

  return {
    ...draft,
    workflow: "video_reference",
    prompt,
    referenceVideoPaths: [...refs],
    output,
  };
}
