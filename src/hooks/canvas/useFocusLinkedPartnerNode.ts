import { useCallback } from "react";
import { useFitView } from "@/hooks/canvas/useFitView";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";
import type { FlowNodeData } from "@/lib/types";
import type { Node } from "@xyflow/react";

export type FocusPartnerKind = "audio" | "video" | "image" | "default";

type FocusPartnerOptions = {
  kind?: FocusPartnerKind;
  /** 状态栏展示名；缺省用节点 label */
  label?: string;
};

/**
 * 选中关联节点、适配视口，并按类型打开对应生成底栏（音频 TTS / 视频·图片生成面板钉住）。
 */
export function useFocusLinkedPartnerNode() {
  const nodes = useProjectStore((s) => s.nodes);
  const setSelectedNodeIds = useProjectStore((s) => s.setSelectedNodeIds);
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const setAudioTtsPanelNodeId = useCanvasUiStore((s) => s.setAudioTtsPanelNodeId);
  const setAudioTtsPanelPinnedNodeId = useCanvasUiStore((s) => s.setAudioTtsPanelPinnedNodeId);
  const setVideoGenPanelPinnedNodeId = useCanvasUiStore((s) => s.setVideoGenPanelPinnedNodeId);
  const setImageGenPanelPinnedNodeId = useCanvasUiStore((s) => s.setImageGenPanelPinnedNodeId);
  const { fitViewToNode } = useFitView();

  const focusPartnerNode = useCallback(
    async (partnerNodeId: string, options: FocusPartnerOptions = {}) => {
      const partner = nodes.find((n) => n.id === partnerNodeId) as Node<FlowNodeData> | undefined;
      if (!partner) {
        setStatusText("关联节点不存在或已删除");
        return false;
      }

      const kind = options.kind ?? "default";
      const displayLabel =
        options.label ?? (partner.data.label?.trim() || partner.type || partnerNodeId);

      setSelectedNodeIds([partnerNodeId]);

      if (kind === "audio") {
        setAudioTtsPanelNodeId(partnerNodeId);
        setAudioTtsPanelPinnedNodeId(partnerNodeId);
      } else if (kind === "video") {
        setVideoGenPanelPinnedNodeId(partnerNodeId);
      } else if (kind === "image") {
        setImageGenPanelPinnedNodeId(partnerNodeId);
      }

      await fitViewToNode(partnerNodeId);
      setStatusText(`已定位到「${displayLabel}」`);
      return true;
    },
    [
      fitViewToNode,
      nodes,
      setAudioTtsPanelNodeId,
      setAudioTtsPanelPinnedNodeId,
      setImageGenPanelPinnedNodeId,
      setSelectedNodeIds,
      setStatusText,
      setVideoGenPanelPinnedNodeId,
    ],
  );

  return { focusPartnerNode };
}
