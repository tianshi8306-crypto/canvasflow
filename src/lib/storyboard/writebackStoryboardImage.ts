import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData, StoryboardShot } from "@/lib/types";
import {
  getScriptBeatIdFromParams,
  orderedIncomingScriptNodeIds,
} from "@/lib/incomingScriptBinding";

/**
 * 图片节点生成成功后，将主图路径写回上游脚本节点的 `storyboardShots[].imagePath`。
 * 需已绑定 `params.scriptBeatId` 且存在启用中的脚本连线。
 */
export function writebackStoryboardShotImagePath(opts: {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  imageNodeId: string;
  imageRelPath: string;
  updateNodeData: (id: string, patch: Partial<FlowNodeData>) => void;
}): boolean {
  const { nodes, edges, imageNodeId, imageRelPath, updateNodeData } = opts;
  const rel = imageRelPath.trim();
  if (!rel) return false;

  const imageNode = nodes.find((n) => n.id === imageNodeId);
  if (!imageNode || imageNode.type !== "imageNode") return false;

  const beatId = getScriptBeatIdFromParams(imageNode.data);
  if (!beatId) return false;

  const scriptIds = orderedIncomingScriptNodeIds(nodes, edges, imageNodeId);
  if (scriptIds.length === 0) return false;
  const scriptNodeId = scriptIds[0]!;
  const scriptNode = nodes.find((n) => n.id === scriptNodeId && n.type === "scriptNode");
  if (!scriptNode) return false;

  const shots = [...(scriptNode.data.storyboardShots ?? [])];
  const idx = shots.findIndex((s) => s.scriptBeatId === beatId);
  const visualFallback =
    imageNode.data.prompt?.trim() ||
    scriptNode.data.scriptBeats?.find((b) => b.id === beatId)?.description?.trim() ||
    "";

  const assetId = imageNode.data.assetId?.trim() || undefined;
  const patch: Partial<StoryboardShot> = {
    imagePath: rel,
    ...(assetId ? { imageAssetId: assetId } : {}),
    status: "generated",
    error: undefined,
  };

  if (idx >= 0) {
    shots[idx] = { ...shots[idx]!, ...patch };
  } else {
    shots.push({
      scriptBeatId: beatId,
      visualPrompt: visualFallback,
      ...patch,
    });
  }

  updateNodeData(scriptNodeId, { storyboardShots: shots });
  return true;
}
