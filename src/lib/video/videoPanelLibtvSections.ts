import type { VideoGenerationWorkflow } from "@/lib/videoNodeTypes";

export type VideoWorkflowTabDef = {
  id: VideoGenerationWorkflow;
  label: string;
};

/** LibTV 主 Tab 顺序（参考视频见 `videoWorkflowTabsForPanel`） */
export const VIDEO_WORKFLOW_LIBTV: ReadonlyArray<VideoWorkflowTabDef> = [
  { id: "text_to_video", label: "文生视频" },
  { id: "multimodal_reference", label: "全能参考" },
  { id: "image_to_video", label: "图生视频" },
  { id: "first_last_frame", label: "首尾帧" },
  { id: "image_reference", label: "图片参考" },
];

export const VIDEO_WORKFLOW_VIDEO_REF_TAB: VideoWorkflowTabDef = {
  id: "video_reference",
  label: "参考视频",
};

/** @deprecated 使用 VIDEO_WORKFLOW_LIBTV */
export const VIDEO_WORKFLOW_PRIMARY: ReadonlyArray<VideoWorkflowTabDef> = [
  { id: "text_to_video", label: "文生视频" },
  { id: "image_to_video", label: "图生视频" },
  { id: "video_reference", label: "参考视频" },
];

/** @deprecated 使用 VIDEO_WORKFLOW_LIBTV */
export const VIDEO_WORKFLOW_ADVANCED: ReadonlyArray<VideoWorkflowTabDef> = [
  { id: "multimodal_reference", label: "全能参考" },
  { id: "first_last_frame", label: "首尾帧" },
  { id: "image_reference", label: "图片参考" },
];

export const VIDEO_PANEL_SECTIONS = {
  reference: { full: "参考素材与工具", compact: "参考" },
  prompt: { full: "提示词", compact: "提示词" },
  output: { full: "输出与生成", compact: "输出" },
} as const;

/** 面板可见 Tab：有上游参考视频时追加「参考视频」 */
export function videoWorkflowTabsForPanel(options: { hasIncomingVideoRef: boolean }) {
  if (options.hasIncomingVideoRef) {
    return [...VIDEO_WORKFLOW_LIBTV, VIDEO_WORKFLOW_VIDEO_REF_TAB];
  }
  return [...VIDEO_WORKFLOW_LIBTV];
}

export function allVideoWorkflowTabs() {
  return [...VIDEO_WORKFLOW_LIBTV, VIDEO_WORKFLOW_VIDEO_REF_TAB];
}
