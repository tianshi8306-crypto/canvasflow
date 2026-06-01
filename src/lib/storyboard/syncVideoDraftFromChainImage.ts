import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import {
  collectVideoIncomingRefItems,
  detectWorkflow,
  resolveIncomingRefItemsForDraft,
  splitIncomingRefsForDraft,
} from "@/hooks/useVideoIncomingReferenceItems";
import {
  defaultVideoGenerationDraft,
  defaultVideoNodePersisted,
  type VideoNodePersisted,
} from "@/lib/videoNodeTypes";

/**
 * 批量视频前：把上游连线中的成片路径写入 video draft，并据连线推断 workflow。
 */
export async function ensureVideoDraftReferencesFromUpstream(opts: {
  videoNodeId: string;
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  projectPath: string;
  updateNodeData: (id: string, patch: Partial<FlowNodeData>) => void;
}): Promise<boolean> {
  const { videoNodeId, nodes, edges, projectPath, updateNodeData } = opts;
  const videoNode = nodes.find((n) => n.id === videoNodeId);
  if (videoNode?.type !== "videoNode") return false;

  const items = collectVideoIncomingRefItems(videoNodeId, nodes, edges);
  const resolved = await resolveIncomingRefItemsForDraft(projectPath, items);
  const { referenceImagePaths, referenceVideoPaths, referenceAudioPaths } =
    splitIncomingRefsForDraft(resolved);

  const curVideo = (videoNode.data.video ?? defaultVideoNodePersisted()) as VideoNodePersisted;
  const draft = { ...defaultVideoGenerationDraft(), ...curVideo.draft };
  const detected = detectWorkflow(resolved, draft.prompt ?? "");
  const nextWorkflow = detected ?? draft.workflow;

  const sameI =
    (draft.referenceImagePaths ?? []).join() === referenceImagePaths.join();
  const sameV =
    (draft.referenceVideoPaths ?? []).join() === referenceVideoPaths.join();
  const sameA =
    (draft.referenceAudioPaths ?? []).join() === referenceAudioPaths.join();
  if (sameI && sameV && sameA && nextWorkflow === draft.workflow) {
    return referenceImagePaths.length > 0 || referenceVideoPaths.length > 0;
  }

  updateNodeData(videoNodeId, {
    video: {
      ...curVideo,
      draft: {
        ...draft,
        workflow: nextWorkflow,
        referenceImagePaths,
        referenceVideoPaths,
        referenceAudioPaths,
      },
    },
  });

  return referenceImagePaths.length > 0 || referenceVideoPaths.length > 0;
}
