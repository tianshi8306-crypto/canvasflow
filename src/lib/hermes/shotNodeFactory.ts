/**
 * Shot 节点工厂：根据 storyboardShots 创建 imageNode + videoNode 配对
 */

import type { Node } from "@xyflow/react";
import { newNodeDataByType } from "@/lib/canvasNodeDefaults";
import { defaultVideoNodePersisted, defaultVideoGenerationDraft } from "@/lib/videoNodeTypes";
import type { StoryboardShot, ScriptBeat, FlowNodeData } from "@/lib/types";
import type { HermesShotNodeGroup } from "./types";

const NODE_HORIZONTAL_GAP = 400;
const NODE_VERTICAL_GAP = 160;

/**
 * 计算单个 shot 节点组的位置
 */
export function calcShotNodePosition(
  baseX: number,
  baseY: number,
  shotIndex: number,
): { imageNodePos: { x: number; y: number }; videoNodePos: { x: number; y: number } } {
  const offsetY = shotIndex * NODE_VERTICAL_GAP;
  return {
    imageNodePos: { x: baseX, y: baseY + offsetY },
    videoNodePos: { x: baseX + NODE_HORIZONTAL_GAP, y: baseY + offsetY },
  };
}

/**
 * 根据单个 StoryboardShot 创建 imageNode + videoNode 配对
 */
export function createShotNodePair(
  shot: StoryboardShot,
  beat: ScriptBeat | undefined,
  basePosition: { x: number; y: number },
  shotIndex: number,
): { nodes: Node<FlowNodeData>[]; group: HermesShotNodeGroup } {
  const imageNodeId = crypto.randomUUID();
  const videoNodeId = crypto.randomUUID();

  const prompt = shot.visualPrompt?.trim() || beat?.description?.trim() || "";
  const shotLabel = beat?.shotNumber ? `镜${beat.shotNumber}` : "图片";
  const videoLabel = beat?.shotNumber ? `视频-${beat.shotNumber}` : "视频";

  const { imageNodePos, videoNodePos } = calcShotNodePosition(
    basePosition.x,
    basePosition.y,
    shotIndex,
  );

  // imageNode
  const imageNode: Node<FlowNodeData> = {
    id: imageNodeId,
    type: "imageNode",
    position: imageNodePos,
    data: {
      ...newNodeDataByType.imageNode(),
      label: shotLabel,
      prompt,
      params: {
        scriptBeatId: shot.scriptBeatId,
        shotNumber: beat?.shotNumber,
      },
    },
  };

  // videoNode
  const videoNode: Node<FlowNodeData> = {
    id: videoNodeId,
    type: "videoNode",
    position: videoNodePos,
    data: {
      ...newNodeDataByType.videoNode(),
      label: videoLabel,
      prompt,
      params: {
        scriptBeatId: shot.scriptBeatId,
        shotNumber: beat?.shotNumber,
      },
      video: {
        ...defaultVideoNodePersisted(),
        draft: {
          ...defaultVideoGenerationDraft(),
          workflow: "text_to_video",
          prompt,
        },
      },
    },
  };

  return {
    nodes: [imageNode, videoNode],
    group: {
      imageGenNodeId: imageNodeId,
      videoShotNodeId: videoNodeId,
      scriptBeatId: shot.scriptBeatId,
      shotIndex,
    },
  };
}
