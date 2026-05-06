import { newNodeDataByType } from "@/lib/canvasNodeDefaults";
import { makeFlowEdge } from "@/lib/flowEdge";
import type { AnchorMenuKey } from "@/lib/nodeAnchorMenus";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";
import type { FlowNodeData } from "@/lib/types";
import type { Node } from "@xyflow/react";
import { isEdgeDisabled } from "@/lib/edgeState";

const PARTNER_GAP = 400;

function hasOutgoingToType(
  edges: { source: string; target: string; data?: unknown }[],
  nodes: { id: string; type?: string | null }[],
  sourceId: string,
  targetType: "videoNode" | "audioNode",
): boolean {
  const next = edges
    .filter((e) => !isEdgeDisabled(e) && e.source === sourceId)
    .map((e) => e.target);
  return next.some((tid) => nodes.find((n) => n.id === tid)?.type === targetType);
}

function hasIncomingOfType(
  edges: { source: string; target: string; data?: unknown }[],
  nodes: { id: string; type?: string | null }[],
  targetId: string,
  sourceType: "imageNode",
): boolean {
  const prev = edges
    .filter((e) => !isEdgeDisabled(e) && e.target === targetId)
    .map((e) => e.source);
  return prev.some((sid) => nodes.find((n) => n.id === sid)?.type === sourceType);
}

function mergeTextWorkflow(
  nodeId: string,
  workflow: "textToVideo" | "textToMusic" | "imageToPrompt",
) {
  const get = useProjectStore.getState();
  const node = get.nodes.find((n) => n.id === nodeId);
  if (!node) return;
  const data = node.data;
  const base = data.params && typeof data.params === "object" ? { ...data.params } : {};
  get.updateNodeData(nodeId, { params: { ...base, textWorkflow: workflow } });
}

/**
 * 点击节点左右锚点菜单项：创建并联线节点，或执行特殊动作（TTS、首尾帧向导等）。
 */
export function dispatchAnchorMenuPick(opts: {
  anchorNodeId: string;
  anchorType: string | undefined;
  direction: "incoming" | "outgoing";
  key: AnchorMenuKey;
}): void {
  const { anchorNodeId, anchorType, direction, key } = opts;
  const get = useProjectStore.getState();
  const anchor = get.nodes.find((n) => n.id === anchorNodeId);
  if (!anchor) return;

  if (key === "audioTts") {
    useCanvasUiStore.getState().setAudioTtsPanelNodeId(anchorNodeId);
    get.setStatusText("已打开文字转语音面板（在节点内配置）");
    return;
  }

  if (key === "videoFirstLastSetup") {
    get.setupFirstLastFrameForVideoNode(anchorNodeId);
    return;
  }

  if (key === "videoFirstFrameSetup") {
    get.setupFirstFrameVideoForVideoNode(anchorNodeId);
    return;
  }

  if (key === "imageI2iImport") {
    useCanvasUiStore.getState().setImageI2iTargetNodeId(anchorNodeId);
    get.setStatusText("请选择参考图（图生图）");
    return;
  }

  const nodes = get.nodes;
  const edges = get.edges;
  const { x, y } = anchor.position;

  // —— 视频节点：左侧输入列优先走专用布局 ——
  if (anchorType === "videoNode" && direction === "incoming") {
    if (key === "imageNode") {
      get.addInputNodeLeftOfVideo(anchorNodeId, "image");
      return;
    }
    if (key === "videoNode") {
      get.addInputNodeLeftOfVideo(anchorNodeId, "referenceVideo");
      return;
    }
    if (key === "audioNode") {
      get.addInputNodeLeftOfVideo(anchorNodeId, "audio");
      return;
    }
  }

  // —— 文本节点：与原「尝试」工作流对齐 ——
  if (anchorType === "textNode") {
    if (direction === "outgoing" && key === "videoNode") {
      if (hasOutgoingToType(edges, nodes, anchorNodeId, "videoNode")) {
        mergeTextWorkflow(anchorNodeId, "textToVideo");
        get.setStatusText("已连接视频节点");
        return;
      }
      const vid = crypto.randomUUID();
      const node: Node<FlowNodeData> = {
        id: vid,
        type: "videoNode",
        position: { x: x + PARTNER_GAP, y },
        data: newNodeDataByType.videoNode(),
      };
      get.addNodesWithEdges([node], [makeFlowEdge(anchorNodeId, vid, "textNode")]);
      mergeTextWorkflow(anchorNodeId, "textToVideo");
      get.setSelectedNodeIds([vid]);
      get.setStatusText("已添加视频节点并联线");
      return;
    }
    if (direction === "outgoing" && key === "audioNode") {
      if (hasOutgoingToType(edges, nodes, anchorNodeId, "audioNode")) {
        mergeTextWorkflow(anchorNodeId, "textToMusic");
        get.setStatusText("已连接音频节点");
        return;
      }
      const aid = crypto.randomUUID();
      const node: Node<FlowNodeData> = {
        id: aid,
        type: "audioNode",
        position: { x: x + PARTNER_GAP, y },
        data: newNodeDataByType.audioNode(),
      };
      get.addNodesWithEdges([node], [makeFlowEdge(anchorNodeId, aid, "textNode")]);
      mergeTextWorkflow(anchorNodeId, "textToMusic");
      get.setSelectedNodeIds([aid]);
      get.setStatusText("已添加音频节点并联线");
      return;
    }
    if (direction === "incoming" && key === "imageNode") {
      if (hasIncomingOfType(edges, nodes, anchorNodeId, "imageNode")) {
        mergeTextWorkflow(anchorNodeId, "imageToPrompt");
        get.setStatusText("已连接图片节点");
        return;
      }
      const imgId = crypto.randomUUID();
      const node: Node<FlowNodeData> = {
        id: imgId,
        type: "imageNode",
        position: { x: x - PARTNER_GAP, y },
        data: newNodeDataByType.imageNode(),
      };
      get.addNodesWithEdges([node], [makeFlowEdge(imgId, anchorNodeId, "imageNode")]);
      mergeTextWorkflow(anchorNodeId, "imageToPrompt");
      get.setSelectedNodeIds([imgId]);
      get.setStatusText("已添加图片节点并联线");
      return;
    }
  }

  // —— 通用：水平错位创建 ——
  get.spawnAnchoredPartner({
    anchorNodeId,
    direction,
    partnerType: key as keyof typeof newNodeDataByType,
  });
}

