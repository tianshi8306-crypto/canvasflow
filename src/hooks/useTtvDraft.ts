import { useCallback, useState } from "react";
import {
  defaultVideoGenerationDraft,
  defaultVideoNodePersisted,
  type VideoGenerationDraft,
  type VideoGenerationDraftPatch,
} from "@/lib/videoNodeTypes";
import { VIDEO_GENERATION_DRAFT_PROMPT_MAX_CHARS } from "@/lib/promptLimits";
import { useProjectStore } from "@/store/projectStore";

function mergeDraft(base: VideoGenerationDraft, patch: VideoGenerationDraftPatch): VideoGenerationDraft {
  const merged = {
    ...base,
    ...patch,
    output: patch.output ? { ...base.output, ...patch.output } : base.output,
    cameraMovement:
      patch.cameraMovement !== undefined
        ? { ...(base.cameraMovement ?? {}), ...patch.cameraMovement }
        : base.cameraMovement,
  };
  const nextPrompt = (merged.prompt ?? "").slice(0, VIDEO_GENERATION_DRAFT_PROMPT_MAX_CHARS);
  return { ...merged, prompt: nextPrompt };
}

/**
 * 文生视频面板草稿：视频节点写入 `data.video`；文本节点仅内存态。
 */
export function useTtvDraft(videoNodeId: string | undefined) {
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const storedDraft = useProjectStore((s) => {
    if (!videoNodeId) return undefined;
    return s.nodes.find((n) => n.id === videoNodeId)?.data.video?.draft;
  });

  const [localDraft, setLocalDraft] = useState(defaultVideoGenerationDraft);

  const draft = videoNodeId ? (storedDraft ?? defaultVideoGenerationDraft()) : localDraft;

  const patchDraft = useCallback(
    (patch: VideoGenerationDraftPatch) => {
      if (videoNodeId) {
        const cur = useProjectStore.getState().nodes.find((n) => n.id === videoNodeId)?.data.video;
        const nextDraft = mergeDraft(cur?.draft ?? defaultVideoGenerationDraft(), patch);
        const vp = { ...defaultVideoNodePersisted(), ...cur, draft: nextDraft };
        updateNodeData(videoNodeId, { video: vp });
      } else {
        setLocalDraft((d) => mergeDraft(d, patch));
      }
    },
    [videoNodeId, updateNodeData],
  );

  return { draft, patchDraft };
}
