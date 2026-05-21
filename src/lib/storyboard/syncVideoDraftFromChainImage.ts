import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { isEdgeDisabled } from "@/lib/edgeState";
import {
  detectWorkflow,
  resolveIncomingRefItemsForDraft,
  splitIncomingRefsForDraft,
  type VideoIncomingRefItem,
} from "@/hooks/useVideoIncomingReferenceItems";
import {
  defaultVideoGenerationDraft,
  defaultVideoNodePersisted,
  type VideoNodePersisted,
} from "@/lib/videoNodeTypes";

function collectIncomingRefItems(
  videoNodeId: string,
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
): VideoIncomingRefItem[] {
  const incoming = edges.filter(
    (e) =>
      !isEdgeDisabled(e) &&
      e.target === videoNodeId &&
      (!e.targetHandle || e.targetHandle === "in"),
  );
  const sourceIds = [...new Set(incoming.map((e) => e.source))];
  const items: VideoIncomingRefItem[] = [];

  for (const sid of sourceIds) {
    const n = nodes.find((x) => x.id === sid);
    if (!n) continue;
    const p = n.data.path?.trim();
    const aid = n.data.assetId?.trim();
    if (!p && !aid) continue;
    const edge = incoming.find((e) => e.source === sid);
    const eid = edge?.id ?? "";
    if (n.type === "imageNode") {
      items.push({ kind: "image", path: p ?? "", assetId: aid, y: n.position.y, edgeId: eid });
    } else if (n.type === "videoNode") {
      items.push({ kind: "video", path: p ?? "", assetId: aid, y: n.position.y, edgeId: eid });
    } else if (n.type === "audioNode") {
      items.push({ kind: "audio", path: p ?? "", assetId: aid, y: n.position.y, edgeId: eid });
    }
  }

  items.sort((a, b) => a.y - b.y);
  return items;
}

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

  const items = collectIncomingRefItems(videoNodeId, nodes, edges);
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
