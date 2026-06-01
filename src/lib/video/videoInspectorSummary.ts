import { TEXT_TO_VIDEO_ASPECT_LABEL, type VideoGenerationDraft } from "@/lib/videoNodeTypes";
import { VIDEO_BUILTIN_MODEL_OPTIONS } from "@/lib/videoGeneration/catalog";

/** Inspector 只读一行摘要，与底栏 draft 对齐 */
export function formatVideoDraftInspectorSummary(
  draft: VideoGenerationDraft,
  modelLabel?: string,
): string {
  const label =
    modelLabel?.trim() ||
    VIDEO_BUILTIN_MODEL_OPTIONS.find((m) => m.id === draft.modelId)?.label ||
    draft.modelId ||
    "未选模型";
  const shortLabel = label.replace(/（CLI）/g, "").replace(/Doubao[- ]/i, "").trim();
  const aspect = draft.output.aspectRatio;
  const aspectText =
    aspect === "auto" ? "自动比例" : (TEXT_TO_VIDEO_ASPECT_LABEL[aspect] ?? aspect);
  const duration =
    draft.output.durationSec === -1 ? "智能时长" : `${draft.output.durationSec}s`;
  const audio = draft.output.generateAudio ? "有音频" : "无音频";
  const extras: string[] = [];
  if (draft.output.noSubtitles) extras.push("去字幕");
  if (draft.output.watermark) extras.push("水印");
  const tail = extras.length ? ` · ${extras.join(" · ")}` : "";
  return `${shortLabel} · ${aspectText} · ${duration} · ${audio}${tail}`;
}
