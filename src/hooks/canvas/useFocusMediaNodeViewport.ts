import { useCallback } from "react";
import { useReactFlow, type Node } from "@xyflow/react";
import { resolveNodeLayoutFootprint } from "@/lib/nodeLayout";
import type { FlowNodeData } from "@/lib/types";

export const MEDIA_PREVIEW_FOCUS_ZOOM = 2;
export const MEDIA_PREVIEW_FOCUS_DURATION_MS = 420;

const MEDIA_NODE_TYPES = new Set(["imageNode", "videoNode"]);

export function getMediaNodeFlowCenter(node: Node<FlowNodeData>): { x: number; y: number } {
  const { w, h } = resolveNodeLayoutFootprint(node);
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
