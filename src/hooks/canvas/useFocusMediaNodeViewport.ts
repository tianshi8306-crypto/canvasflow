import { useCallback } from "react";
import { useReactFlow, type Node } from "@xyflow/react";
import {
  computeImageNodeFrameSize,
  resolveImageNodeFrameRatio,
} from "@/lib/imageGeneration/imageAspectSize";
import { readImageOutputParams } from "@/lib/imageGeneration/imageOutputParams";
import {
  computeVideoNodeFrameSize,
  resolveVideoNodeFrameRatio,
} from "@/lib/videoGeneration/videoAspectSize";
import { nodeLayoutDimensions } from "@/lib/nodeLayout";
import type { FlowNodeData } from "@/lib/types";
import type { TextToVideoAspectId } from "@/lib/videoNodeTypes";

export const MEDIA_PREVIEW_FOCUS_ZOOM = 2;
export const MEDIA_PREVIEW_FOCUS_DURATION_MS = 420;

const MEDIA_NODE_TYPES = new Set(["imageNode", "videoNode"]);

export function getMediaNodeFlowCenter(node: Node<FlowNodeData>): { x: number; y: number } {
  let { w, h } = nodeLayoutDimensions(node);

  if (node.type === "imageNode" && (node.measured?.width == null || node.measured.width <= 0)) {
    const outputParams = readImageOutputParams(node.data?.params);
    const ratio = resolveImageNodeFrameRatio({
      aspectId: outputParams.aspect,
      imageWidth: node.data?.imageWidth,
      imageHeight: node.data?.imageHeight,
    });
    const frame = computeImageNodeFrameSize(ratio);
    w = frame.width;
    h = frame.height;
  }

  if (node.type === "videoNode" && (node.measured?.width == null || node.measured.width <= 0)) {
    const aspectId =
      (node.data?.video?.draft?.output?.aspectRatio as TextToVideoAspectId | undefined) ?? "16:9";
    const ratio = resolveVideoNodeFrameRatio({ aspectId });
    const frame = computeVideoNodeFrameSize(ratio);
    w = frame.width;
    h = frame.height;
  }

  return {
    x: node.position.x + w / 2,
    y: node.position.y + h / 2,
  };
}

export function useFocusMediaNodeViewport() {
  const { getNode, setCenter, getViewport } = useReactFlow();

  const focusMediaNodeAt200 = useCallback(
    async (nodeId: string): Promise<boolean> => {
      const node = getNode(nodeId);
      if (!node?.type || !MEDIA_NODE_TYPES.has(node.type)) return false;

      const center = getMediaNodeFlowCenter(node as Node<FlowNodeData>);
      try {
        await setCenter(center.x, center.y, {
          zoom: MEDIA_PREVIEW_FOCUS_ZOOM,
          duration: MEDIA_PREVIEW_FOCUS_DURATION_MS,
        });
        return true;
      } catch {
        return false;
      }
    },
    [getNode, setCenter],
  );

  return { focusMediaNodeAt200, getViewport };
}

/** @deprecated Use useFocusMediaNodeViewport */
export function useFocusImageNodeViewport() {
  const { focusMediaNodeAt200, getViewport } = useFocusMediaNodeViewport();
  return { focusImageNodeAt200: focusMediaNodeAt200, getViewport };
}

export const IMAGE_PREVIEW_FOCUS_ZOOM = MEDIA_PREVIEW_FOCUS_ZOOM;
export const IMAGE_PREVIEW_FOCUS_DURATION_MS = MEDIA_PREVIEW_FOCUS_DURATION_MS;
export const getImageNodeFlowCenter = getMediaNodeFlowCenter;
