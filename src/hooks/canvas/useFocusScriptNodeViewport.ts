import { useCallback } from "react";
import { useReactFlow, type Node } from "@xyflow/react";
import { computeScriptNodeFrameSize } from "@/lib/scriptNodeChrome";
import { nodeLayoutDimensions } from "@/lib/nodeLayout";
import type { FlowNodeData } from "@/lib/types";
import {
  MEDIA_PREVIEW_FOCUS_DURATION_MS,
  MEDIA_PREVIEW_FOCUS_ZOOM,
} from "@/hooks/canvas/useFocusMediaNodeViewport";

export function getScriptNodeFlowCenter(node: Node<FlowNodeData>): { x: number; y: number } {
  let { w, h } = nodeLayoutDimensions(node);
  if (node.measured?.width == null || node.measured.width <= 0) {
    const beatCount = node.data?.scriptBeats?.length ?? 0;
    const hasPreview = beatCount > 0;
    const frame = computeScriptNodeFrameSize(hasPreview, beatCount);
    w = frame.width;
    h = frame.height;
  }
  return {
    x: node.position.x + w / 2,
    y: node.position.y + h / 2,
  };
}

/** 双击脚本节点：画布 zoom 2.0 并居中（不打开全屏） */
export function useFocusScriptNodeViewport() {
  const { getNode, setCenter } = useReactFlow();

  const focusScriptNodeAt200 = useCallback(
    async (nodeId: string): Promise<boolean> => {
      const node = getNode(nodeId);
      if (node?.type !== "scriptNode") return false;
      const center = getScriptNodeFlowCenter(node as Node<FlowNodeData>);
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

  return { focusScriptNodeAt200 };
}
