import { isEdgeDisabled } from "@/lib/edgeState";
import type { FlowNodeData, TextWorkflowKind } from "@/lib/types";
import type { Edge, Node } from "@xyflow/react";

type TextParamsPatch = {
  textWorkflow?: TextWorkflowKind;
  videoNodeId?: string;
  audioNodeId?: string;
  scriptNodeId?: string;
  imageNodeId?: string;
};

function findLinkedNodeId(
  edges: Edge[],
  nodes: Node<FlowNodeData>[],
  textNodeId: string,
  direction: "incoming" | "outgoing",
  partnerType: string,
): string | null {
  const candidates =
    direction === "outgoing"
      ? edges
          .filter((e) => !isEdgeDisabled(e) && e.source === textNodeId)
          .map((e) => e.target)
      : edges
          .filter((e) => !isEdgeDisabled(e) && e.target === textNodeId)
          .map((e) => e.source);
  return (
    candidates.find((id) => nodes.find((n) => n.id === id)?.type === partnerType) ?? null
  );
}

function findLinkedImageTargetId(
  edges: Edge[],
  nodes: Node<FlowNodeData>[],
  textNodeId: string,
): string | null {
  for (const kind of ["imageNode", "imageAsset"] as const) {
    const id = findLinkedNodeId(edges, nodes, textNodeId, "outgoing", kind);
    if (id) return id;
  }
  return null;
}

/** 根据连线推断文本节点工作流（无「尝试」菜单，以图结构为准；仅 metadata，不驱动底栏） */
export function inferTextWorkflowPatch(
  textNodeId: string,
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
): TextParamsPatch {
  const videoOut = findLinkedNodeId(edges, nodes, textNodeId, "outgoing", "videoNode");
  if (videoOut) {
    return { textWorkflow: "textToVideo", videoNodeId: videoOut };
  }

  const audioOut = findLinkedNodeId(edges, nodes, textNodeId, "outgoing", "audioNode");
  if (audioOut) {
    return { textWorkflow: "textToMusic", audioNodeId: audioOut };
  }

  const scriptOut = findLinkedNodeId(edges, nodes, textNodeId, "outgoing", "scriptNode");
  if (scriptOut) {
    return { textWorkflow: "textToScript", scriptNodeId: scriptOut };
  }

  const imageOut = findLinkedImageTargetId(edges, nodes, textNodeId);
  if (imageOut) {
    return { textWorkflow: "textToImage", imageNodeId: imageOut };
  }

  const videoIn = findLinkedNodeId(edges, nodes, textNodeId, "incoming", "videoNode");
  if (videoIn) {
    return { textWorkflow: "videoToPrompt", videoNodeId: videoIn };
  }

  const imageIn = findLinkedNodeId(edges, nodes, textNodeId, "incoming", "imageNode");
  if (imageIn) {
    return { textWorkflow: "imageToPrompt" };
  }

  const scriptIn = findLinkedNodeId(edges, nodes, textNodeId, "incoming", "scriptNode");
  if (scriptIn) {
    return { textWorkflow: "scriptToText", scriptNodeId: scriptIn };
  }

  return {
    textWorkflow: undefined,
    videoNodeId: undefined,
    audioNodeId: undefined,
    scriptNodeId: undefined,
    imageNodeId: undefined,
  };
}

export function applyTextWorkflowPatch(
  prevParams: unknown,
  patch: TextParamsPatch,
): Record<string, unknown> {
  const base =
    prevParams && typeof prevParams === "object" && !Array.isArray(prevParams)
      ? { ...(prevParams as Record<string, unknown>) }
      : {};

  if (patch.textWorkflow === "textToVideo") {
    base.textWorkflow = "textToVideo";
    if (patch.videoNodeId) base.videoNodeId = patch.videoNodeId;
    delete base.audioNodeId;
    delete base.scriptNodeId;
    delete base.imageNodeId;
  } else if (patch.textWorkflow === "textToMusic") {
    base.textWorkflow = "textToMusic";
    if (patch.audioNodeId) base.audioNodeId = patch.audioNodeId;
    delete base.videoNodeId;
    delete base.scriptNodeId;
    delete base.imageNodeId;
  } else if (patch.textWorkflow === "textToScript") {
    base.textWorkflow = "textToScript";
    if (patch.scriptNodeId) base.scriptNodeId = patch.scriptNodeId;
    delete base.videoNodeId;
    delete base.audioNodeId;
    delete base.imageNodeId;
  } else if (patch.textWorkflow === "textToImage") {
    base.textWorkflow = "textToImage";
    if (patch.imageNodeId) base.imageNodeId = patch.imageNodeId;
    delete base.videoNodeId;
    delete base.audioNodeId;
    delete base.scriptNodeId;
  } else if (patch.textWorkflow === "videoToPrompt") {
    base.textWorkflow = "videoToPrompt";
    if (patch.videoNodeId) base.videoNodeId = patch.videoNodeId;
    delete base.audioNodeId;
    delete base.scriptNodeId;
    delete base.imageNodeId;
  } else if (patch.textWorkflow === "imageToPrompt") {
    base.textWorkflow = "imageToPrompt";
    delete base.videoNodeId;
    delete base.audioNodeId;
    delete base.scriptNodeId;
    delete base.imageNodeId;
  } else if (patch.textWorkflow === "scriptToText") {
    base.textWorkflow = "scriptToText";
    if (patch.scriptNodeId) base.scriptNodeId = patch.scriptNodeId;
    delete base.videoNodeId;
    delete base.audioNodeId;
    delete base.imageNodeId;
  } else {
    delete base.textWorkflow;
    delete base.videoNodeId;
    delete base.audioNodeId;
    delete base.scriptNodeId;
    delete base.imageNodeId;
  }

  return base;
}

/** 连线变更后同步画布上全部文本节点 workflow */
function paramsEqual(a: unknown, b: Record<string, unknown>): boolean {
  if (!a || typeof a !== "object" || Array.isArray(a)) {
    return Object.keys(b).length === 0;
  }
  const prev = a as Record<string, unknown>;
  const keys = new Set([...Object.keys(prev), ...Object.keys(b)]);
  for (const k of keys) {
    if (prev[k] !== b[k]) return false;
  }
  return true;
}

/** 单次 immutable 更新全部文本节点 params（不触发逐节点 undo） */
export function applyTextWorkflowSyncToNodes(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
): Node<FlowNodeData>[] {
  let anyChanged = false;
  const next = nodes.map((node) => {
    if (node.type !== "textNode") return node;
    const patch = inferTextWorkflowPatch(node.id, nodes, edges);
    const params = applyTextWorkflowPatch(node.data.params, patch);
    if (paramsEqual(node.data.params, params)) return node;
    anyChanged = true;
    return { ...node, data: { ...node.data, params } };
  });
  return anyChanged ? next : nodes;
}

/** @deprecated 优先使用 applyTextWorkflowSyncToNodes + 单次 set */
export function syncAllTextNodeWorkflows(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  updateNodeData: (
    id: string,
    patch: { params: Record<string, unknown> },
    opts?: { silent?: boolean },
  ) => void,
): void {
  for (const node of nodes) {
    if (node.type !== "textNode") continue;
    const patch = inferTextWorkflowPatch(node.id, nodes, edges);
    const params = applyTextWorkflowPatch(node.data.params, patch);
    if (paramsEqual(node.data.params, params)) continue;
    updateNodeData(node.id, { params }, { silent: true });
  }
}
